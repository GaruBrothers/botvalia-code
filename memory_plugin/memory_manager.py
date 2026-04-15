from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Tuple

from .embedding_service import LocalHashEmbedding
from .importance_scorer import ImportanceScorer
from .memory_injector import InjectorConfig, MemoryInjector
from .memory_saver import MemorySaver, SaverConfig
from .vector_store import SQLiteVectorStore


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

    storage_dir = cfg.get("storage_dir", ".botvalia/infinite_memory")
    _ensure_dir(storage_dir)

    sqlite_path = cfg.get("sqlite_path", "memory.sqlite3")
    log_path = cfg.get("log_path", "interactions.jsonl")
    if not os.path.isabs(sqlite_path):
      sqlite_path = str(Path(storage_dir) / sqlite_path)
    if not os.path.isabs(log_path):
      log_path = str(Path(storage_dir) / log_path)

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

    injected_messages, used_memories = self.injector.inject_into_messages(messages)
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
      )
    if _is_sync_stream(result):
      return self._wrap_sync_stream(
        result,
        user_text=user_text,
        used_memories=used_memories,
        meta=meta,
      )

    assistant_text = _extract_assistant_text(result)
    self.saver.save_turn(
      user_text=user_text,
      assistant_text=assistant_text,
      extra_meta={
        "used_memories": [m.id for m in used_memories],
        **(meta or {}),
      },
    )
    return result

  def _wrap_sync_stream(
    self,
    stream: Iterable[Any],
    *,
    user_text: str,
    used_memories: List[Any],
    meta: Optional[Dict[str, Any]],
  ) -> Iterator[Any]:
    buffer_parts: List[str] = []

    def gen() -> Iterator[Any]:
      try:
        for chunk in stream:
          buffer_parts.append(_extract_stream_text(chunk))
          yield chunk
      finally:
        assistant_text = "".join(buffer_parts).strip()
        self.saver.save_turn(
          user_text=user_text,
          assistant_text=assistant_text,
          extra_meta={
            "used_memories": [m.id for m in used_memories],
            "streaming": True,
            **(meta or {}),
          },
        )

    return gen()

  def _wrap_async_stream(
    self,
    stream: Any,
    *,
    user_text: str,
    used_memories: List[Any],
    meta: Optional[Dict[str, Any]],
  ) -> Any:
    buffer_parts: List[str] = []

    async def agen():
      try:
        async for chunk in stream:
          buffer_parts.append(_extract_stream_text(chunk))
          yield chunk
      finally:
        assistant_text = "".join(buffer_parts).strip()
        self.saver.save_turn(
          user_text=user_text,
          assistant_text=assistant_text,
          extra_meta={
            "used_memories": [m.id for m in used_memories],
            "streaming": True,
            **(meta or {}),
          },
        )

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
  """
  Best-effort extraction for streaming chunk payloads (provider-agnostic).
  Supports:
  - plain strings
  - dicts with common delta fields
  """
  if chunk is None:
    return ""
  if isinstance(chunk, str):
    return chunk
  if isinstance(chunk, bytes):
    try:
      return chunk.decode("utf-8", errors="ignore")
    except Exception:
      return ""
  if isinstance(chunk, dict):
    # OpenAI-like: {"choices":[{"delta":{"content":"..."}}]}
    if "choices" in chunk and isinstance(chunk["choices"], list) and chunk["choices"]:
      c0 = chunk["choices"][0]
      if isinstance(c0, dict):
        delta = c0.get("delta")
        if isinstance(delta, dict) and "content" in delta and isinstance(delta["content"], str):
          return delta["content"]
        if "text" in c0 and isinstance(c0["text"], str):
          return c0["text"]
    # Anthropic-like events: {"type":"content_block_delta","delta":{"text":"..."}}
    delta = chunk.get("delta")
    if isinstance(delta, dict) and "text" in delta and isinstance(delta["text"], str):
      return delta["text"]
    if "text" in chunk and isinstance(chunk["text"], str):
      return chunk["text"]
    if "content" in chunk:
      c = chunk["content"]
      if isinstance(c, str):
        return c
      if isinstance(c, list):
        parts: List[str] = []
        for blk in c:
          if isinstance(blk, dict) and blk.get("type") == "text":
            parts.append(str(blk.get("text", "")))
        return "\n".join(parts).strip()
  return ""
