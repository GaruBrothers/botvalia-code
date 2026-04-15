from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional


def _maybe_parse_sse(payload: str) -> Optional[Dict[str, Any]]:
  """
  Parse common SSE lines: "data: {...}" or "data:{...}".
  Returns dict if JSON payload, else None.
  """
  if not payload:
    return None
  s = payload.strip()
  if not s.startswith("data:"):
    return None
  data = s[len("data:") :].strip()
  if not data or data == "[DONE]":
    return None
  try:
    parsed = json.loads(data)
    return parsed if isinstance(parsed, dict) else None
  except Exception:
    return None


def detect_stream_format(chunk: Any) -> str:
  """
  Returns: 'openai', 'anthropic', or 'generic'
  """
  if chunk is None:
    return "generic"

  if isinstance(chunk, (bytes, bytearray)):
    try:
      chunk = chunk.decode("utf-8", errors="ignore")
    except Exception:
      return "generic"

  if isinstance(chunk, str):
    parsed = _maybe_parse_sse(chunk)
    if parsed is not None:
      chunk = parsed
    else:
      return "generic"

  if isinstance(chunk, dict):
    # OpenAI/OpenRouter: {"choices":[{"delta":{"content":"..."}}]}
    if "choices" in chunk and isinstance(chunk.get("choices"), list):
      return "openai"
    # Anthropic: {"type":"content_block_delta","delta":{"text":"..."}}
    t = chunk.get("type")
    if isinstance(t, str) and (
      t.startswith("content_block_")
      or t in ("message_start", "message_delta", "message_stop")
    ):
      return "anthropic"

  return "generic"


def extract_openai_chunk(chunk: Any) -> str:
  """
  OpenAI-compatible streaming chunk extraction.
  Supports:
  - choices[].delta.content
  - choices[].delta.tool_calls (ignored)
  - choices[].text (legacy)
  - SSE "data: {...}"
  """
  if chunk is None:
    return ""

  if isinstance(chunk, (bytes, bytearray)):
    try:
      chunk = chunk.decode("utf-8", errors="ignore")
    except Exception:
      return ""

  if isinstance(chunk, str):
    parsed = _maybe_parse_sse(chunk)
    if parsed is not None:
      chunk = parsed
    else:
      # raw text delta (rare)
      return chunk

  if not isinstance(chunk, dict):
    return ""

  choices = chunk.get("choices")
  if not isinstance(choices, list) or not choices:
    return ""

  c0 = choices[0]
  if not isinstance(c0, dict):
    return ""

  delta = c0.get("delta")
  if isinstance(delta, dict):
    content = delta.get("content")
    if isinstance(content, str):
      return content
    # Some providers use {"delta":{"text":"..."}}
    text = delta.get("text")
    if isinstance(text, str):
      return text

  # Legacy completions stream
  text = c0.get("text")
  if isinstance(text, str):
    return text

  return ""


def extract_anthropic_chunk(chunk: Any) -> str:
  """
  Anthropic streaming event extraction.
  Supports:
  - content_block_delta: delta.text
  - content_block_start: content_block.text (rare; usually tool/thinking)
  - message_delta: delta.text (rare)
  - SSE "data: {...}" (some gateways)
  """
  if chunk is None:
    return ""

  if isinstance(chunk, (bytes, bytearray)):
    try:
      chunk = chunk.decode("utf-8", errors="ignore")
    except Exception:
      return ""

  if isinstance(chunk, str):
    parsed = _maybe_parse_sse(chunk)
    if parsed is not None:
      chunk = parsed
    else:
      return ""

  if not isinstance(chunk, dict):
    return ""

  event_type = chunk.get("type")
  if not isinstance(event_type, str):
    return ""

  if event_type == "content_block_delta":
    delta = chunk.get("delta")
    if isinstance(delta, dict):
      text = delta.get("text")
      if isinstance(text, str):
        return text
  if event_type == "message_delta":
    delta = chunk.get("delta")
    if isinstance(delta, dict):
      text = delta.get("text")
      if isinstance(text, str):
        return text
  if event_type == "content_block_start":
    cb = chunk.get("content_block")
    if isinstance(cb, dict):
      text = cb.get("text")
      if isinstance(text, str):
        return text

  return ""


def extract_generic_chunk(chunk: Any) -> str:
  """
  Generic fallback extractor. Uses common fields if present.
  """
  if chunk is None:
    return ""
  if isinstance(chunk, str):
    return chunk
  if isinstance(chunk, (bytes, bytearray)):
    try:
      return chunk.decode("utf-8", errors="ignore")
    except Exception:
      return ""
  if isinstance(chunk, dict):
    if "text" in chunk and isinstance(chunk["text"], str):
      return chunk["text"]
    if "delta" in chunk and isinstance(chunk["delta"], dict):
      d = chunk["delta"]
      if "text" in d and isinstance(d["text"], str):
        return d["text"]
      if "content" in d and isinstance(d["content"], str):
        return d["content"]
    if "content" in chunk:
      c = chunk["content"]
      if isinstance(c, str):
        return c
      if isinstance(c, list):
        parts = []
        for blk in c:
          if isinstance(blk, dict) and blk.get("type") == "text":
            parts.append(str(blk.get("text", "")))
        return "\n".join(parts).strip()
  return ""


def extract_stream_text(chunk: Any) -> str:
  fmt = detect_stream_format(chunk)
  if fmt == "openai":
    return extract_openai_chunk(chunk)
  if fmt == "anthropic":
    return extract_anthropic_chunk(chunk)
  return extract_generic_chunk(chunk)

