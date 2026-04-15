# Infinite Memory Plugin (BotValia Code)

This is a **pluggable middleware layer** that adds persistent “infinite memory” **without modifying BotValia Code’s core logic**.

It works in two integration modes:

1) **In-process wrapper**: wrap any Python LLM call function with `wrapLLMCall(originalFunction, messages)`.
2) **HTTP proxy (optional)**: run `python -m memory_plugin.proxy` and point BotValia/OpenRouter/Anthropic base URL at the proxy via environment variables.

## Files

- `memory_plugin/memory_manager.py` — orchestrates injection + saving
- `memory_plugin/memory_injector.py` — retrieval, ranking, token-optimized injection (top 5)
- `memory_plugin/memory_saver.py` — importance scoring + dedup + persistent storage
- `memory_plugin/embedding_service.py` — local embeddings (hashing trick) (no deps)
- `memory_plugin/vector_store.py` — SQLite-based vector store (brute force cosine)
- `memory_plugin/importance_scorer.py` — heuristic scoring (0..1) + tagging
- `memory_plugin/config.json` — plugin config

## Storage

By default, all plugin data is stored under:

`./.botvalia/infinite_memory/`

- `memory.sqlite3` — structured memory rows + embeddings
- `interactions.jsonl` — raw interaction log

## Integration (Python wrapper)

```python
from memory_plugin import wrapLLMCall

def original_llm_call(messages):
  # call your provider here, return response
  return {"content": [{"type": "text", "text": "hello"}]}

messages = [{"role": "user", "content": "Remember: use bun, not npm."}]
result = wrapLLMCall(original_llm_call, messages)
print(result)
```

## Integration (CLI via proxy, optional)

Run the proxy:

```bash
python -m memory_plugin.proxy --listen 127.0.0.1:4010 --upstream https://openrouter.ai/api
```

Then point BotValia to it (no code changes needed):

```powershell
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:4010"
```

Note: the proxy currently focuses on non-streaming JSON responses (it forwards streaming unchanged but won’t always extract text from streams for saving).

