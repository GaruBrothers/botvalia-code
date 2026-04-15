from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple


_code_fence = re.compile(r"```")
_stacktrace = re.compile(r"\b(Exception|Traceback|StackTrace|ERROR|ERR!|E[A-Z0-9_]+)\b")
_preference = re.compile(r"\b(always|never|prefer|prefiero|siempre|nunca|por favor|please)\b", re.IGNORECASE)
_architecture = re.compile(r"\b(architecture|arquitectura|design|diseño|pattern|patr[oó]n|module|m[oó]dulo|api|endpoint|schema|db|database)\b", re.IGNORECASE)
_bugfix = re.compile(r"\b(fix|fixed|bug|issue|error|arregl|solucion|correg)\b", re.IGNORECASE)


def _clamp01(x: float) -> float:
  return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


@dataclass(frozen=True)
class ImportanceScorer:
  """
  Heuristic importance scoring (0..1) that is fast and dependency-free.
  """

  def score(
    self,
    *,
    user_text: str,
    assistant_text: str,
    novelty_similarity: Optional[float],
    tags: List[str],
  ) -> float:
    text = (user_text or "") + "\n" + (assistant_text or "")
    length = len(text)

    score = 0.10
    if _code_fence.search(text):
      score += 0.25
    if _stacktrace.search(text):
      score += 0.20
    if _architecture.search(text):
      score += 0.18
    if _bugfix.search(text):
      score += 0.12
    if _preference.search(text):
      score += 0.22

    # Longer isn't always better; mild boost up to a point.
    if length > 200:
      score += 0.05
    if length > 800:
      score += 0.05

    # Tag bonuses
    if "user_preference" in tags:
      score += 0.18
    if "architecture" in tags:
      score += 0.12
    if "bug_fix" in tags:
      score += 0.10

    # Novelty: if very similar to existing memory, reduce.
    if novelty_similarity is not None:
      # similarity close to 1 => not novel
      score *= 1.0 - (max(0.0, novelty_similarity) ** 2) * 0.55

    return _clamp01(score)


def suggest_tags(user_text: str, assistant_text: str) -> List[str]:
  txt = (user_text or "") + "\n" + (assistant_text or "")
  tags: List[str] = []
  if _preference.search(txt):
    tags.append("user_preference")
  if _architecture.search(txt):
    tags.append("architecture")
    tags.append("project")
  if _bugfix.search(txt) or _stacktrace.search(txt):
    tags.append("bug_fix")
  if "api" in txt.lower() or "endpoint" in txt.lower():
    tags.append("api")
  if "sql" in txt.lower() or "postgres" in txt.lower() or "sqlite" in txt.lower():
    tags.append("db")
  # de-dupe while preserving order
  seen = set()
  out: List[str] = []
  for t in tags:
    if t in seen:
      continue
    seen.add(t)
    out.append(t)
  return out

