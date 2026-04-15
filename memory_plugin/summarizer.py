from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


def _truncate(s: str, n: int) -> str:
  s = (s or "").strip()
  if len(s) <= n:
    return s
  return s[: max(0, n - 1)] + "…"


_decision = re.compile(
  r"\b(decide|decision|we will|we'll|should|must|prefer|use\b|set\b|always|never|policy|standard)\b",
  re.IGNORECASE,
)
_preference = re.compile(r"\b(prefer|prefiero|always|never|siempre|nunca)\b", re.IGNORECASE)
_pattern = re.compile(r"\b(pattern|convention|guideline|best practice|estándar|convención)\b", re.IGNORECASE)
_project = re.compile(r"\b(project|repo|codebase|arquitectura|architecture|module|módulo|api|endpoint|db|database)\b", re.IGNORECASE)
_code_fence = re.compile(r"```")


@dataclass(frozen=True)
class Summarizer:
  """
  Production-friendly summarizer without LLM dependencies.
  Extracts only durable info: decisions, patterns, preferences, project context.
  """

  max_summary_chars: int = 180
  max_text_chars: int = 1200

  def summarize(self, user_text: str, assistant_text: str) -> Dict[str, str]:
    combined = ((user_text or "").strip() + "\n" + (assistant_text or "").strip()).strip()
    if not combined:
      return {"summary": "", "text": ""}

    lines = [ln.strip() for ln in combined.splitlines() if ln.strip()]

    decisions: List[str] = []
    preferences: List[str] = []
    project: List[str] = []
    patterns: List[str] = []

    for ln in lines:
      if _preference.search(ln):
        preferences.append(ln)
        continue
      if _decision.search(ln):
        decisions.append(ln)
        continue
      if _pattern.search(ln):
        patterns.append(ln)
        continue
      if _project.search(ln):
        project.append(ln)

    picked: List[str] = []
    picked.extend(decisions[:3])
    picked.extend(patterns[:2])
    picked.extend(preferences[:2])
    picked.extend(project[:2])

    if not picked:
      # fallback: first informative line
      picked = lines[:2]

    summary = _truncate(" · ".join(picked), self.max_summary_chars)

    # Token-optimized text to store: keep a compact, relevant subset.
    text_parts: List[str] = []
    if decisions:
      text_parts.append("Decisions:\n" + "\n".join(f"- {x}" for x in decisions[:5]))
    if patterns:
      text_parts.append("Patterns:\n" + "\n".join(f"- {x}" for x in patterns[:5]))
    if preferences:
      text_parts.append("Preferences:\n" + "\n".join(f"- {x}" for x in preferences[:5]))
    if project:
      text_parts.append("Project context:\n" + "\n".join(f"- {x}" for x in project[:6]))

    if not text_parts:
      text_parts.append(_truncate(combined, self.max_text_chars))

    text = "\n\n".join(text_parts)
    # Preserve a tiny code signal (helps retrieval) without storing full dumps.
    if _code_fence.search(combined) and "```" not in text:
      text = text + "\n\n(contains code)"

    return {"summary": summary, "text": _truncate(text, self.max_text_chars)}

