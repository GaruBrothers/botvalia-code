from __future__ import annotations

import json
import os
import sys
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Tuple

from .embedding_service import LocalHashEmbedding
from .importance_scorer import ImportanceScorer
from .memory_injector import InjectorConfig, MemoryInjector
from .memory_saver import MemorySaver, SaverConfig
from .vector_store import SQLiteVectorStore
from .stream_adapter import extract_stream_text


def _default_config_path() -> str:
  return str(Path(__file__).with_name("config.json"))


def _ensure_dir(p: str) -> None:
  Path(p).mkdir(parents=True, exist_ok=True)


def _extract_assistant_text(result: Any) -> str:
  """
  Best-effort extraction for common client return types:
  - dict with 'content' (Anthropic blocks)
  - dict with 'choices' (OpenAI-like)
  - plain string
  """
  if result is None:
    return ""
  if isinstance(result, str):
    return result
  if isinstance(result, dict):
    if "content" in result:
      c = result["content"]
      if isinstance(c, str):
        return c
      if isinstance(c, list):
        parts: List[str] = []
        for blk in c:
          if isinstance(blk, dict) and blk.get("type") == "text":
            parts.append(str(blk.get("text", "")))
          elif isinstance(blk, dict) and "text" in blk:
            parts.append(str(blk.get("text", "")))
        return "\n".join(parts).strip()
    if "choices" in result and isinstance(result["choices"], list) and result["choices"]:
      choice = result["choices"][0]
      if isinstance(choice, dict):
        msg = choice.get("message")
        if isinstance(msg, dict):
          return str(msg.get("content", "")).strip()
        return str(choice.get("text", "")).strip()
  # Fallback to repr
  return str(result)


def _extract_user_text(messages: List[Dict[str, Any]]) -> str:
  for m in reversed(messages):
    if m.get("role") == "user":
      c = m.get("content", "")
      if isinstance(c, str):
        return c.strip()
      if isinstance(c, list):
        parts: List[str] = []
        for blk in c:
          if isinstance(blk, dict) and blk.get("type") == "text":
            parts.append(str(blk.get("text", "")))
        return "\n".join(parts).strip()
  return ""


@dataclass
class MemoryManager:
  """
  Pluggable wrapper around any LLM call:
    1) Retrieve relevant memories (top 5), inject into prompt
    2) Call original LLM function
    3) Extract/store important info persistently
  """

  config_path: Optional[str] = None

  def __post_init__(self) -> None:
    config_path = self.config_path or _default_config_path()
    with open(config_path, "r", encoding="utf-8") as f:
      cfg = json.load(f)
    self.cfg = cfg
    self.debug = bool(cfg.get("debug", False))

    storage_dir = cfg.get("storage_dir", ".botvalia/infinite_memory")
    _ensure_dir(storage_dir)

    sqlite_path = cfg.get("sqlite_path", "memory.sqlite3")
    log_path = cfg.get("log_path", "interactions.jsonl")
    if not os.path.isabs(sqlite_path):
      sqlite_path = str(Path(storage_dir) / sqlite_path)
    if not os.path.isabs(log_path):
      log_path = str(Path(storage_dir) / log_path)
    self.debug_log_path = str(Path(storage_dir) / "debug.jsonl")

    emb_cfg = cfg.get("embedding", {})
    dims = int(emb_cfg.get("dims", 512))
    # Default: local hashing embedder (no deps, no network)
    self.embedder = LocalHashEmbedding(dims)

    self.store = SQLiteVectorStore(sqlite_path, dims=dims)
    self.scorer = ImportanceScorer()

    r_cfg = cfg.get("retrieval", {})
    self.injector = MemoryInjector(
      store=self.store,
      embedder=self.embedder,
      config=InjectorConfig(
        max_results=int(r_cfg.get("max_results", 5)),
        min_similarity=float(r_cfg.get("min_similarity", 0.18)),
        max_injected_chars=int(r_cfg.get("max_injected_chars", 2200)),
        max_memory_chars_each=int(r_cfg.get("max_memory_chars_each", 700)),
        score_similarity_weight=float(r_cfg.get("score_similarity_weight", 0.75)),
        score_importance_weight=float(r_cfg.get("score_importance_weight", 0.25)),
        score_recency_weight=float(r_cfg.get("score_recency_weight", 0.10)),
        recency_half_life_days=float(r_cfg.get("recency_half_life_days", 30.0)),
        max_injected_tokens=int(r_cfg.get("max_injected_tokens", 450)),
      ),
    )

    d_cfg = cfg.get("dedup", {})
    i_cfg = cfg.get("importance", {})
    self.saver = MemorySaver(
      store=self.store,
      embedder=self.embedder,
      scorer=self.scorer,
      config=SaverConfig(
        log_path=log_path,
        min_store=float(i_cfg.get("min_store", 0.35)),
        dedup_similarity=float(d_cfg.get("min_similarity", 0.88)),
      ),
    )

    self.max_memories_per_scope = int(cfg.get("limits", {}).get("max_memories_per_scope", 1000))

  def _dbg(self, event: str, payload: Dict[str, Any]) -> None:
    if not self.debug:
      return
    try:
      rec = {"event": event, **payload}
      with open(self.debug_log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
      # never break main flow
      return

  def _resolve_scope(self, meta: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    scope_meta = (meta or {}).get("scope") if isinstance(meta, dict) else None
    scope: Dict[str, Optional[str]] = {}
    if isinstance(scope_meta, dict):
      scope["project_id"] = scope_meta.get("project_id")
      scope["user_id"] = scope_meta.get("user_id")
      scope["session_id"] = scope_meta.get("session_id")

    scope.setdefault("project_id", os.environ.get("BOTVALIA_PROJECT_ID") or os.path.basename(os.getcwd()))
    scope.setdefault("user_id", os.environ.get("BOTVALIA_USER_ID") or os.environ.get("USERNAME") or os.environ.get("USER") or "default")
    scope.setdefault("session_id", os.environ.get("BOTVALIA_SESSION_ID"))

    # normalize empties to None
    for k in ["project_id", "user_id", "session_id"]:
      v = scope.get(k)
      if v is None:
        continue
      if isinstance(v, str) and not v.strip():
        scope[k] = None
      elif isinstance(v, str):
        scope[k] = v.strip()
    return scope

  def _scope_key(self, scope: Dict[str, Optional[str]]) -> str:
    p = scope.get("project_id") or ""
    u = scope.get("user_id") or ""
    s = scope.get("session_id") or ""
    return f"{p}|{u}|{s}"

  def enabled(self) -> bool:
    return bool(self.cfg.get("enabled", True))

  def wrap_llm_call(
    self,
    originalFunction: Callable[[List[Dict[str, Any]]], Any],
    messages: List[Dict[str, Any]],
    *,
    meta: Optional[Dict[str, Any]] = None,
  ) -> Any:
    if not self.enabled():
      return originalFunction(messages)

    scope = self._resolve_scope(meta)
    injected_messages, used_memories = self.injector.inject_into_messages(messages, scope=scope)
    self._dbg("inject", {"scope": scope, "used_memory_ids": [m.id for m in used_memories]})
    result = originalFunction(injected_messages)

    user_text = _extract_user_text(messages)

    # Streaming support:
    # - If result is an iterator/generator, we yield chunks while buffering text.
    # - Only after the stream completes, we persist memory.
    if _is_async_iterable(result):
      return self._wrap_async_stream(
        result,
        user_text=user_text,
        used_memories=used_memories,
        meta=meta,
        scope=scope,
      )
    if _is_sync_stream(result):
      return self._wrap_sync_stream(
        result,
        user_text=user_text,
        used_memories=used_memories,
        meta=meta,
        scope=scope,
      )

    assistant_text = _extract_assistant_text(result)
    save_result = self.saver.save_turn(
      user_text=user_text,
      assistant_text=assistant_text,
      scope=scope,
      extra_meta={
        "used_memories": [m.id for m in used_memories],
        **(meta or {}),
      },
    )
    self._dbg(
      "save",
      {
        "scope": scope,
        "assistant_chars": len(assistant_text),
        "result": save_result,
      },
    )
    if hasattr(self.store, "prune_scope") and self.max_memories_per_scope > 0:
      deleted = self.store.prune_scope(scope, self.max_memories_per_scope)  # type: ignore[attr-defined]
      if deleted:
        self._dbg("prune", {"scope": scope, "deleted": deleted, "max": self.max_memories_per_scope})
    return result

  def _wrap_sync_stream(
    self,
    stream: Iterable[Any],
    *,
    user_text: str,
    used_memories: List[Any],
    meta: Optional[Dict[str, Any]],
    scope: Dict[str, Optional[str]],
  ) -> Iterator[Any]:
    buffer_parts: List[str] = []

    def gen() -> Iterator[Any]:
      try:
        for chunk in stream:
          buffer_parts.append(_extract_stream_text(chunk))
          yield chunk
      finally:
        assistant_text = "".join(buffer_parts).strip()
        save_result = self.saver.save_turn(
          user_text=user_text,
          assistant_text=assistant_text,
          scope=scope,
          extra_meta={
            "used_memories": [m.id for m in used_memories],
            "streaming": True,
            **(meta or {}),
          },
        )
        self._dbg(
          "save_stream",
          {"scope": scope, "assistant_chars": len(assistant_text), "result": save_result},
        )
        if hasattr(self.store, "prune_scope") and self.max_memories_per_scope > 0:
          deleted = self.store.prune_scope(scope, self.max_memories_per_scope)  # type: ignore[attr-defined]
          if deleted:
            self._dbg("prune", {"scope": scope, "deleted": deleted, "max": self.max_memories_per_scope})

    return gen()

  def _wrap_async_stream(
    self,
    stream: Any,
    *,
    user_text: str,
    used_memories: List[Any],
    meta: Optional[Dict[str, Any]],
    scope: Dict[str, Optional[str]],
  ) -> Any:
    buffer_parts: List[str] = []

    async def agen():
      try:
        async for chunk in stream:
          buffer_parts.append(_extract_stream_text(chunk))
          yield chunk
      finally:
        assistant_text = "".join(buffer_parts).strip()
        save_result = self.saver.save_turn(
          user_text=user_text,
          assistant_text=assistant_text,
          scope=scope,
          extra_meta={
            "used_memories": [m.id for m in used_memories],
            "streaming": True,
            **(meta or {}),
          },
        )
        self._dbg(
          "save_stream",
          {"scope": scope, "assistant_chars": len(assistant_text), "result": save_result},
        )
        if hasattr(self.store, "prune_scope") and self.max_memories_per_scope > 0:
          deleted = self.store.prune_scope(scope, self.max_memories_per_scope)  # type: ignore[attr-defined]
          if deleted:
            self._dbg("prune", {"scope": scope, "deleted": deleted, "max": self.max_memories_per_scope})

    return agen()


def wrapLLMCall(originalFunction: Callable[[List[Dict[str, Any]]], Any], messages: List[Dict[str, Any]], *, config_path: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Any:
  """
  Required integration hook:
    wrapLLMCall(originalFunction, messages)
  """
  mgr = MemoryManager(config_path=config_path)
  return mgr.wrap_llm_call(originalFunction, messages, meta=meta)


# Re-export helpers for proxy integrations (intentionally light coupling).
extract_user_text = _extract_user_text
extract_assistant_text = _extract_assistant_text


def _is_async_iterable(obj: Any) -> bool:
  return hasattr(obj, "__aiter__")


def _is_sync_stream(obj: Any) -> bool:
  if obj is None:
    return False
  # Avoid treating common payload types as streams.
  if isinstance(obj, (str, bytes, dict, list, tuple)):
    return False
  return hasattr(obj, "__iter__")


def _extract_stream_text(chunk: Any) -> str:
  return extract_stream_text(chunk)
