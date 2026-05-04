<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
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
  # call your provider here, return response (streaming or non-streaming)
  return {"content": [{"type": "text", "text": "hello"}]}

messages = [{"role": "user", "content": "Remember: use bun, not npm."}]
result = wrapLLMCall(original_llm_call, messages)
print(result)
```

### Streaming support

If `original_llm_call(...)` returns an **iterator / generator** (or async iterator),
`wrapLLMCall` will:

1) Yield chunks as-is to the caller
2) Buffer text deltas internally
3) Save memory **only after the stream completes**

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

## Prompt injection format

Memory is injected into the **SYSTEM** prompt only, using a compact structured block:

```
[MEMORY]
facts:
- ...
preferences:
- ...
project context:
- ...
past decisions:
- ...
[/MEMORY]
```

## Scoping (project/user/session)

Memory is isolated by scope:

- `project_id` (required)
- `user_id` (required)
- `session_id` (optional; when provided, retrieval includes both session-specific and session-global entries)

You can provide scope via `wrapLLMCall(..., meta={"scope": {...}})` or environment variables:

- `BOTVALIA_PROJECT_ID`
- `BOTVALIA_USER_ID`
- `BOTVALIA_SESSION_ID`

## Growth limits

Set `limits.max_memories_per_scope` in `config.json` (default 1000). Old low-importance memories are pruned first.

