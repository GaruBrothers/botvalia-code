from __future__ import annotations

import json
import math
import os
import sqlite3
import struct
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


def _now_ms() -> int:
  return int(time.time() * 1000)


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
  return float(sum(x * y for x, y in zip(a, b)))


def _pack_f32(vec: Sequence[float]) -> bytes:
  return struct.pack(f"<{len(vec)}f", *vec)


def _unpack_f32(blob: bytes, dims: int) -> List[float]:
  return list(struct.unpack(f"<{dims}f", blob))


@dataclass
class MemoryRow:
  id: str
  text: str
  summary: str
  tags: List[str]
  importance: float
  created_at_ms: int
  last_accessed_ms: int
  similarity: float = 0.0


class VectorStore:
  def upsert(
    self,
    *,
    memory_id: str,
    text: str,
    summary: str,
    tags: List[str],
    importance: float,
    embedding: Sequence[float],
    meta: Optional[Dict[str, Any]] = None,
  ) -> None:
    raise NotImplementedError

  def search(
    self,
    query_embedding: Sequence[float],
    *,
    limit: int,
  ) -> List[MemoryRow]:
    raise NotImplementedError

  def touch(self, memory_ids: Iterable[str]) -> None:
    raise NotImplementedError

  def get_top_similar(
    self,
    query_embedding: Sequence[float],
    *,
    limit: int,
  ) -> List[Tuple[str, float]]:
    rows = self.search(query_embedding, limit=limit)
    return [(r.id, r.similarity) for r in rows]


class SQLiteVectorStore(VectorStore):
  def __init__(self, db_path: str, dims: int) -> None:
    self.db_path = db_path
    self.dims = dims
    Path(os.path.dirname(db_path) or ".").mkdir(parents=True, exist_ok=True)
    self._conn = sqlite3.connect(db_path)
    self._conn.execute("PRAGMA journal_mode=WAL;")
    self._conn.execute("PRAGMA synchronous=NORMAL;")
    self._init_schema()

  def _init_schema(self) -> None:
    self._conn.execute(
      """
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        summary TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        importance REAL NOT NULL,
        created_at_ms INTEGER NOT NULL,
        last_accessed_ms INTEGER NOT NULL,
        embedding BLOB NOT NULL,
        meta_json TEXT,
        is_obsolete INTEGER NOT NULL DEFAULT 0,
        superseded_by TEXT
      );
      """
    )
    self._conn.execute(
      "CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed_ms);"
    )
    self._conn.execute(
      "CREATE INDEX IF NOT EXISTS idx_memories_obsolete ON memories(is_obsolete);"
    )
    # Migrations for older DBs (best-effort).
    try:
      self._conn.execute("ALTER TABLE memories ADD COLUMN is_obsolete INTEGER NOT NULL DEFAULT 0;")
    except Exception:
      pass
    try:
      self._conn.execute("ALTER TABLE memories ADD COLUMN superseded_by TEXT;")
    except Exception:
      pass
    self._conn.commit()

  def upsert(
    self,
    *,
    memory_id: str,
    text: str,
    summary: str,
    tags: List[str],
    importance: float,
    embedding: Sequence[float],
    meta: Optional[Dict[str, Any]] = None,
  ) -> None:
    created = _now_ms()
    blob = _pack_f32(embedding)
    self._conn.execute(
      """
      INSERT INTO memories(id, text, summary, tags_json, importance, created_at_ms, last_accessed_ms, embedding, meta_json, is_obsolete, superseded_by)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
      ON CONFLICT(id) DO UPDATE SET
        text=excluded.text,
        summary=excluded.summary,
        tags_json=excluded.tags_json,
        importance=excluded.importance,
        last_accessed_ms=excluded.last_accessed_ms,
        embedding=excluded.embedding,
        meta_json=excluded.meta_json,
        is_obsolete=0,
        superseded_by=NULL;
      """,
      (
        memory_id,
        text,
        summary,
        json.dumps(tags, ensure_ascii=False),
        float(importance),
        created,
        created,
        blob,
        json.dumps(meta, ensure_ascii=False) if meta else None,
      ),
    )
    self._conn.commit()

  def search(
    self,
    query_embedding: Sequence[float],
    *,
    limit: int,
  ) -> List[MemoryRow]:
    # Minimal, dependency-free brute force cosine similarity (vectors are expected to be normalized).
    cur = self._conn.execute(
      "SELECT id, text, summary, tags_json, importance, created_at_ms, last_accessed_ms, embedding, is_obsolete FROM memories WHERE is_obsolete=0"
    )
    rows: List[MemoryRow] = []
    for (
      memory_id,
      text,
      summary,
      tags_json,
      importance,
      created_at_ms,
      last_accessed_ms,
      emb_blob,
      is_obsolete,
    ) in cur.fetchall():
      if int(is_obsolete) != 0:
        continue
      emb = _unpack_f32(emb_blob, self.dims)
      sim = _dot(query_embedding, emb)
      rows.append(
        MemoryRow(
          id=str(memory_id),
          text=str(text),
          summary=str(summary),
          tags=json.loads(tags_json) if tags_json else [],
          importance=float(importance),
          created_at_ms=int(created_at_ms),
          last_accessed_ms=int(last_accessed_ms),
          similarity=float(sim),
        )
      )

    rows.sort(key=lambda r: r.similarity, reverse=True)
    return rows[: max(0, int(limit))]

  def touch(self, memory_ids: Iterable[str]) -> None:
    ids = list(memory_ids)
    if not ids:
      return
    t = _now_ms()
    self._conn.executemany(
      "UPDATE memories SET last_accessed_ms=? WHERE id=?",
      [(t, memory_id) for memory_id in ids],
    )
    self._conn.commit()

  def mark_obsolete(self, memory_id: str, superseded_by: str) -> None:
    t = _now_ms()
    self._conn.execute(
      "UPDATE memories SET is_obsolete=1, superseded_by=?, last_accessed_ms=? WHERE id=?",
      (superseded_by, t, memory_id),
    )
    self._conn.commit()

  def get_by_id(self, memory_id: str) -> Optional[MemoryRow]:
    cur = self._conn.execute(
      "SELECT id, text, summary, tags_json, importance, created_at_ms, last_accessed_ms FROM memories WHERE id=?",
      (memory_id,),
    )
    row = cur.fetchone()
    if not row:
      return None
    id_, text, summary, tags_json, importance, created_at_ms, last_accessed_ms = row
    return MemoryRow(
      id=str(id_),
      text=str(text),
      summary=str(summary),
      tags=json.loads(tags_json) if tags_json else [],
      importance=float(importance),
      created_at_ms=int(created_at_ms),
      last_accessed_ms=int(last_accessed_ms),
      similarity=0.0,
    )


# Optional high-performance vector backends (install separately):
# - faiss-cpu + numpy
# - chromadb


try:
  import numpy as _np  # type: ignore
  import faiss as _faiss  # type: ignore

  class FaissVectorStore(SQLiteVectorStore):
    """
    FAISS-backed ANN search with SQLite persistence for metadata.
    Falls back to brute force if faiss/numpy aren't installed.
    """

    def __init__(self, db_path: str, dims: int) -> None:
      super().__init__(db_path, dims)
      self._index = _faiss.IndexFlatIP(dims)
      self._id_map: List[str] = []
      self._rebuild()

    def _rebuild(self) -> None:
      cur = self._conn.execute("SELECT id, embedding FROM memories")
      ids: List[str] = []
      vecs: List[List[float]] = []
      for memory_id, emb_blob in cur.fetchall():
        ids.append(str(memory_id))
        vecs.append(_unpack_f32(emb_blob, self.dims))
      self._id_map = ids
      self._index.reset()
      if vecs:
        mat = _np.array(vecs, dtype="float32")
        self._index.add(mat)

    def upsert(self, **kwargs) -> None:  # type: ignore[override]
      super().upsert(**kwargs)
      # simplest correctness-first approach: rebuild on each write
      self._rebuild()

    def search(self, query_embedding: Sequence[float], *, limit: int) -> List[MemoryRow]:  # type: ignore[override]
      if len(self._id_map) == 0:
        return []
      q = _np.array([list(query_embedding)], dtype="float32")
      sims, idxs = self._index.search(q, int(limit))
      chosen: List[str] = []
      for idx in idxs[0].tolist():
        if idx < 0 or idx >= len(self._id_map):
          continue
        chosen.append(self._id_map[idx])
      if not chosen:
        return []
      placeholders = ",".join(["?"] * len(chosen))
      cur = self._conn.execute(
        f"SELECT id, text, summary, tags_json, importance, created_at_ms, last_accessed_ms FROM memories WHERE id IN ({placeholders})",
        tuple(chosen),
      )
      by_id: Dict[str, MemoryRow] = {}
      for (
        memory_id,
        text,
        summary,
        tags_json,
        importance,
        created_at_ms,
        last_accessed_ms,
      ) in cur.fetchall():
        by_id[str(memory_id)] = MemoryRow(
          id=str(memory_id),
          text=str(text),
          summary=str(summary),
          tags=json.loads(tags_json) if tags_json else [],
          importance=float(importance),
          created_at_ms=int(created_at_ms),
          last_accessed_ms=int(last_accessed_ms),
          similarity=0.0,
        )
      out: List[MemoryRow] = []
      for sim, idx in zip(sims[0].tolist(), idxs[0].tolist()):
        if idx < 0 or idx >= len(self._id_map):
          continue
        memory_id = self._id_map[idx]
        row = by_id.get(memory_id)
        if not row:
          continue
        row.similarity = float(sim)
        out.append(row)
      out.sort(key=lambda r: r.similarity, reverse=True)
      return out[: int(limit)]

except Exception:
  FaissVectorStore = None  # type: ignore[assignment]


try:
  import chromadb as _chromadb  # type: ignore

  class ChromaVectorStore(VectorStore):
    """
    Chroma-backed vector store (optional). Stores metadata in Chroma.
    """

    def __init__(self, persist_dir: str, collection: str, dims: int) -> None:
      self.dims = dims
      Path(persist_dir).mkdir(parents=True, exist_ok=True)
      self._client = _chromadb.PersistentClient(path=persist_dir)
      self._col = self._client.get_or_create_collection(collection)

    def upsert(
      self,
      *,
      memory_id: str,
      text: str,
      summary: str,
      tags: List[str],
      importance: float,
      embedding: Sequence[float],
      meta: Optional[Dict[str, Any]] = None,
    ) -> None:
      md = {"summary": summary, "tags": tags, "importance": float(importance)}
      if meta:
        md["meta"] = meta
      self._col.upsert(
        ids=[memory_id],
        documents=[text],
        embeddings=[list(embedding)],
        metadatas=[md],
      )

    def search(self, query_embedding: Sequence[float], *, limit: int) -> List[MemoryRow]:
      res = self._col.query(
        query_embeddings=[list(query_embedding)],
        n_results=int(limit),
        include=["documents", "metadatas", "distances"],
      )
      out: List[MemoryRow] = []
      ids = (res.get("ids") or [[]])[0]
      docs = (res.get("documents") or [[]])[0]
      mds = (res.get("metadatas") or [[]])[0]
      dists = (res.get("distances") or [[]])[0]
      for memory_id, doc, md, dist in zip(ids, docs, mds, dists):
        # Chroma distance depends on configuration; treat as similarity-ish if possible.
        sim = float(1.0 - dist) if dist is not None else 0.0
        tags = md.get("tags") if isinstance(md, dict) else []
        importance = float(md.get("importance", 0.0)) if isinstance(md, dict) else 0.0
        summary = md.get("summary", "") if isinstance(md, dict) else ""
        out.append(
          MemoryRow(
            id=str(memory_id),
            text=str(doc),
            summary=str(summary),
            tags=list(tags) if isinstance(tags, list) else [],
            importance=importance,
            created_at_ms=0,
            last_accessed_ms=0,
            similarity=sim,
          )
        )
      out.sort(key=lambda r: r.similarity, reverse=True)
      return out

    def touch(self, memory_ids: Iterable[str]) -> None:
      return

except Exception:
  ChromaVectorStore = None  # type: ignore[assignment]
