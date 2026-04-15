from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.client import HTTPSConnection, HTTPConnection
from typing import Any, Dict, List, Optional, Tuple

from .memory_manager import MemoryManager, extract_assistant_text, extract_user_text


def _read_body(handler: BaseHTTPRequestHandler) -> bytes:
  length = int(handler.headers.get("Content-Length") or "0")
  return handler.rfile.read(length) if length > 0 else b""


def _connection_for(url: urllib.parse.ParseResult):
  if url.scheme == "https":
    return HTTPSConnection(url.netloc)
  return HTTPConnection(url.netloc)


class MemoryProxyHandler(BaseHTTPRequestHandler):
  server_version = "BotValiaInfiniteMemoryProxy/0.1"

  def do_POST(self) -> None:  # noqa: N802
    mgr: MemoryManager = self.server.memory_manager  # type: ignore[attr-defined]
    upstream_base: str = self.server.upstream_base  # type: ignore[attr-defined]

    body = _read_body(self)
    try:
      payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
      payload = {}

    # Inject memory for Anthropic-style requests when possible.
    injected = False
    used_meta: Dict[str, Any] = {}
    scope = mgr._resolve_scope(None)  # type: ignore[attr-defined]
    if isinstance(payload, dict) and isinstance(payload.get("messages"), list):
      messages = payload["messages"]
      injected_messages, used = mgr.injector.inject_into_messages(messages, scope=scope)
      if injected_messages is not messages:
        payload["messages"] = injected_messages
        injected = True
        used_meta = {"used_memories": [m.id for m in used]}

    upstream_url = urllib.parse.urlparse(upstream_base)
    conn = _connection_for(upstream_url)
    upstream_path = upstream_url.path.rstrip("/") + self.path

    # Forward headers (strip hop-by-hop)
    headers = {k: v for k, v in self.headers.items()}
    headers.pop("Host", None)
    headers["Host"] = upstream_url.netloc
    headers["Accept-Encoding"] = "identity"
    out_body = json.dumps(payload).encode("utf-8") if injected else body
    headers["Content-Length"] = str(len(out_body))

    conn.request("POST", upstream_path, body=out_body, headers=headers)
    resp = conn.getresponse()

    self.send_response(resp.status)
    for k, v in resp.getheaders():
      if k.lower() in ("transfer-encoding", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "upgrade"):
        continue
      self.send_header(k, v)
    self.end_headers()

    raw = resp.read()
    self.wfile.write(raw)

    # Best-effort save: non-streaming responses only (JSON).
    try:
      out = json.loads(raw.decode("utf-8"))
      assistant_text = extract_assistant_text(out)
      user_text = extract_user_text(payload.get("messages", []))
      mgr.saver.save_turn(
        user_text=user_text,
        assistant_text=assistant_text,
        scope=scope,
        extra_meta={"proxy": True, **used_meta},
      )
    except Exception:
      pass


def main(argv: Optional[List[str]] = None) -> int:
  p = argparse.ArgumentParser(description="Anthropic-compatible proxy that injects/saves infinite memory.")
  p.add_argument("--config", default=None, help="Path to memory_plugin/config.json")
  p.add_argument("--listen", default="127.0.0.1:4010", help="host:port")
  p.add_argument("--upstream", default=None, help="Upstream base URL (e.g., https://openrouter.ai/api)")
  args = p.parse_args(argv)

  host, port_s = args.listen.split(":")
  port = int(port_s)

  mgr = MemoryManager(config_path=args.config or None)
  upstream = args.upstream or mgr.cfg.get("proxy", {}).get("upstream_base_url")  # type: ignore[attr-defined]
  if not upstream:
    print("Missing --upstream (or proxy.upstream_base_url in config.json)", file=sys.stderr)
    return 2

  httpd = ThreadingHTTPServer((host, port), MemoryProxyHandler)
  httpd.memory_manager = mgr  # type: ignore[attr-defined]
  httpd.upstream_base = upstream  # type: ignore[attr-defined]
  print(f"[memory_proxy] listening on http://{host}:{port} -> {upstream}")
  httpd.serve_forever()
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
