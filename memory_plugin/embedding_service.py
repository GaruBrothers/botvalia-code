from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import List


class EmbeddingService:
  def embed_text(self, text: str) -> List[float]:
    raise NotImplementedError

  @property
  def dims(self) -> int:
    raise NotImplementedError


_token_re = re.compile(r"[A-Za-z0-9_/\-\.]+", re.UNICODE)


def _l2_normalize(vec: List[float]) -> List[float]:
  norm = math.sqrt(sum(v * v for v in vec)) or 1.0
  return [v / norm for v in vec]


@dataclass(frozen=True)
class LocalHashEmbedding(EmbeddingService):
  """
  Minimal, dependency-free local embedding based on a hashing trick.
  Good enough for semantic-ish retrieval without network or heavy models.
  """

  _dims: int = 512

  @property
  def dims(self) -> int:
    return self._dims

  def embed_text(self, text: str) -> List[float]:
    vec = [0.0] * self._dims
    if not text:
      return vec

    tokens = _token_re.findall(text.lower())
    for tok in tokens:
      h = hash(tok)
      idx = h % self._dims
      # signed update for a bit more spread
      sign = -1.0 if (h & 1) else 1.0
      vec[idx] += sign

    return _l2_normalize(vec)

