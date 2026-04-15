from __future__ import annotations

import hashlib
import json
import os
import time
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .importance_scorer import ImportanceScorer, suggest_tags
from .summarizer import Summarizer
from .vector_store import SQLiteVectorStore, VectorStore


def _now_ms() -> int:
  return int(time.time() * 1000)


def _sha1(text: str) -> str:
  return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def _truncate(s: str, n: int) -> str:
  if len(s) <= n:
    return s
  return s[: max(0, n - 1)] + "…"


@dataclass(frozen=True)
class SaverConfig:
  log_path: str
  min_store: float
  dedup_similarity: float
  contradiction_similarity: float = 0.78


class MemorySaver:
  def __init__(
    self,
    *,
    store: VectorStore,
    embedder,
    scorer: ImportanceScorer,
    config: SaverConfig,
  ) -> None:
    self.store = store
    self.embedder = embedder
    self.scorer = scorer
    self.summarizer = Summarizer()
    self.config = config
    Path(os.path.dirname(config.log_path) or ".").mkdir(parents=True, exist_ok=True)

  def _log_interaction(self, record: Dict[str, Any]) -> None:
    with open(self.config.log_path, "a", encoding="utf-8") as f:
      f.write(json.dumps(record, ensure_ascii=False) + "\n")

  def _extract_important(
    self,
    user_text: str,
    assistant_text: str,
  ) -> Optional[Tuple[str, str]]:
    """
    Heuristic memory extraction: returns (text, summary) or None.
    """
    if not user_text and not assistant_text:
      return None

    combined = (user_text or "").strip() + "\n" + (assistant_text or "").strip()
    combined = combined.strip()
    if not combined:
      return None

    # Prefer user preferences and stable decisions; avoid generic chit-chat.
    low_value = ["hola", "como estas", "thanks", "gracias", "ok", "vale", "perfecto"]
    if combined.lower().strip() in low_value:
      return None

    summarized = self.summarizer.summarize(user_text, assistant_text)
    summary = _truncate(summarized.get("summary", ""), 160)
    memory_text = _truncate(summarized.get("text", ""), 2000)
    if not summary and not memory_text:
      return None
    if not summary:
      summary = _truncate(memory_text.splitlines()[0] if memory_text else combined.splitlines()[0], 160)
    if not memory_text:
      memory_text = _truncate(combined, 2000)
    return memory_text, summary

  def _is_contradiction(self, a: str, b: str) -> bool:
    """
    Lightweight contradiction heuristics for durable preferences/decisions.
    """
    a_l = (a or "").lower()
    b_l = (b or "").lower()
    # "use X not Y" vs "use Y not X"
    pat = re.compile(r"\buse\s+([a-z0-9_\-\.]+)\s+not\s+([a-z0-9_\-\.]+)\b")
    ma = pat.search(a_l)
    mb = pat.search(b_l)
    if ma and mb:
      ax, ay = ma.group(1), ma.group(2)
      bx, by = mb.group(1), mb.group(2)
      if ax == by and ay == bx:
        return True
    # always vs never about same keyword
    if ("always" in a_l and "never" in b_l) or ("never" in a_l and "always" in b_l):
      # if they share a salient token
      tokens_a = set(re.findall(r"[a-z0-9_/\-\.]+", a_l))
      tokens_b = set(re.findall(r"[a-z0-9_/\-\.]+", b_l))
      if len((tokens_a & tokens_b)) >= 2:
        return True
    return False

  def save_turn(
    self,
    *,
    user_text: str,
    assistant_text: str,
    extra_meta: Optional[Dict[str, Any]] = None,
  ) -> None:
    record = {
      "ts_ms": _now_ms(),
      "user": user_text,
      "assistant": assistant_text,
      "meta": extra_meta or {},
    }
    self._log_interaction(record)

    extracted = self._extract_important(user_text, assistant_text)
    if not extracted:
      return
    memory_text, summary = extracted

    tags = suggest_tags(user_text, assistant_text)
    emb = self.embedder.embed_text(memory_text)

    # novelty check
    top = self.store.get_top_similar(emb, limit=1)
    top_id = top[0][0] if top else None
    novelty_sim = top[0][1] if top else None

    importance = self.scorer.score(
      user_text=user_text,
      assistant_text=assistant_text,
      novelty_similarity=novelty_sim,
      tags=tags,
    )
    if importance < self.config.min_store:
      return

    # dedup: if extremely similar, update existing instead of inserting a new row
    if (
      novelty_sim is not None
      and top_id
      and novelty_sim >= self.config.dedup_similarity
    ):
      existing = self.store.get_by_id(top_id) if hasattr(self.store, "get_by_id") else None
      if existing and self._is_contradiction(existing.text, memory_text) and novelty_sim >= self.config.contradiction_similarity:
        # Mark old as obsolete and insert new
        memory_id = _sha1(summary + "|" + memory_text)
        if hasattr(self.store, "mark_obsolete"):
          self.store.mark_obsolete(existing.id, memory_id)  # type: ignore[attr-defined]
        self.store.upsert(
          memory_id=memory_id,
          text=memory_text,
          summary=summary,
          tags=tags,
          importance=importance,
          embedding=emb,
          meta={
            "source": "turn",
            "created_at_ms": _now_ms(),
            "supersedes": existing.id,
            "reason": "contradiction",
            **(extra_meta or {}),
          },
        )
        return

      # Merge/update existing
      merged_tags = list(dict.fromkeys((existing.tags if existing else []) + tags)) if existing else tags
      new_importance = max(existing.importance if existing else 0.0, importance)
      self.store.upsert(
        memory_id=top_id,
        text=memory_text,
        summary=summary,
        tags=merged_tags,
        importance=new_importance,
        embedding=emb,
        meta={
          "source": "turn_update",
          "updated_at_ms": _now_ms(),
          "similarity": novelty_sim,
          **(extra_meta or {}),
        },
      )
      return

    memory_id = _sha1(summary + "|" + memory_text)
    self.store.upsert(
      memory_id=memory_id,
      text=memory_text,
      summary=summary,
      tags=tags,
      importance=importance,
      embedding=emb,
      meta={
        "source": "turn",
        "created_at_ms": _now_ms(),
        **(extra_meta or {}),
      },
    )
