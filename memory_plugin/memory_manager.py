from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

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


def wrapLLMCall(originalFunction: Callable[[List[Dict[str, Any]]], Any], messages: List[Dict[str, Any]], *, config_path: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Any:
  """
  Required integration hook:
    wrapLLMCall(originalFunction, messages)
  """
  mgr = MemoryManager(config_path=config_path or _default_config_path())
  return mgr.wrap_llm_call(originalFunction, messages, meta=meta)


# Re-export helpers for proxy integrations (intentionally light coupling).
extract_user_text = _extract_user_text
extract_assistant_text = _extract_assistant_text
