from __future__ import annotations

import os
import re
from dataclasses import dataclass
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .vector_store import MemoryRow, VectorStore


def _truncate(s: str, n: int) -> str:
  s = s.strip()
  if len(s) <= n:
    return s
  return s[: max(0, n - 1)] + "…"


def _extract_latest_user_text(messages: Sequence[Dict[str, Any]]) -> str:
  for m in reversed(messages):
    if m.get("role") == "user":
      c = m.get("content")
      if isinstance(c, str):
        return c.strip()
      if isinstance(c, list):
        # Anthropic-style blocks: [{"type":"text","text":"..."}]
        parts: List[str] = []
        for blk in c:
          if isinstance(blk, dict) and blk.get("type") == "text":
            parts.append(str(blk.get("text", "")))
        txt = "\n".join(parts).strip()
        if txt:
          return txt
  return ""


@dataclass(frozen=True)
class InjectorConfig:
  max_results: int
  min_similarity: float
  max_injected_chars: int
  max_memory_chars_each: int
  score_similarity_weight: float
  score_importance_weight: float
  score_recency_weight: float = 0.10
  recency_half_life_days: float = 30.0


class MemoryInjector:
  def __init__(self, *, store: VectorStore, embedder, config: InjectorConfig) -> None:
    self.store = store
    self.embedder = embedder
    self.config = config

  def _rank(self, rows: List[MemoryRow]) -> List[MemoryRow]:
    w_sim = self.config.score_similarity_weight
    w_imp = self.config.score_importance_weight
    w_rec = self.config.score_recency_weight
    now_ms = int(time.time() * 1000)
    scored: List[Tuple[float, MemoryRow]] = []
    for r in rows:
      age_days = max(0.0, (now_ms - (r.last_accessed_ms or r.created_at_ms or now_ms)) / (1000 * 60 * 60 * 24))
      # Exponential decay: score=1 at age 0, 0.5 at half-life
      half = max(1e-6, float(self.config.recency_half_life_days))
      recency = 0.5 ** (age_days / half)
      score = (r.similarity * w_sim) + (r.importance * w_imp) + (recency * w_rec)
      scored.append((score, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]

  def retrieve(self, user_text: str) -> List[MemoryRow]:
    if not user_text:
      return []
    q = self.embedder.embed_text(user_text)
    rows = self.store.search(q, limit=max(1, int(self.config.max_results) * 4))
    rows = [r for r in rows if r.similarity >= self.config.min_similarity]
    rows = self._rank(rows)[: self.config.max_results]
    if rows:
      self.store.touch([r.id for r in rows])
    return rows

  def inject_into_messages(
    self,
    messages: List[Dict[str, Any]],
  ) -> Tuple[List[Dict[str, Any]], List[MemoryRow]]:
    user_text = _extract_latest_user_text(messages)
    memories = self.retrieve(user_text)
    if not memories:
      return messages, []

    # Structured memory injection in SYSTEM prompt.
    buckets: Dict[str, List[str]] = {
      "facts": [],
      "preferences": [],
      "project_context": [],
      "past_decisions": [],
    }

    def bucket_for(mem: MemoryRow) -> str:
      tags = set(mem.tags or [])
      if "user_preference" in tags:
        return "preferences"
      if "architecture" in tags or "project" in tags or "api" in tags or "db" in tags:
        return "project_context"
      if "bug_fix" in tags:
        return "past_decisions"
      return "facts"

    budget = int(self.config.max_injected_chars)
    for m in memories:
      chunk = (m.summary or m.text or "").strip()
      if not chunk:
        continue
      chunk = _truncate(chunk, int(self.config.max_memory_chars_each))
      entry = f"- {chunk}"
      if len(entry) > budget:
        continue
      buckets[bucket_for(m)].append(entry)
      budget -= len(entry) + 1
      if budget <= 240:
        break

    if not any(buckets.values()):
      return messages, []

    parts: List[str] = ["[MEMORY]"]
    if buckets["facts"]:
      parts.append("facts:")
      parts.extend(buckets["facts"][: self.config.max_results])
    if buckets["preferences"]:
      parts.append("preferences:")
      parts.extend(buckets["preferences"][: self.config.max_results])
    if buckets["project_context"]:
      parts.append("project context:")
      parts.extend(buckets["project_context"][: self.config.max_results])
    if buckets["past_decisions"]:
      parts.append("past decisions:")
      parts.extend(buckets["past_decisions"][: self.config.max_results])

    system_block = "\n".join(parts) + "\n[/MEMORY]"

    injected = list(messages)
    injected.insert(0, {"role": "system", "content": system_block})
    return injected, memories
