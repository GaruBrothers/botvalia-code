# BotValia Source Code Reconstruction

[![Bun](https://img.shields.io/badge/Bun-≥1.3.5-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![License](https://img.shields.io/badge/license-Research_&_Learning-red)](.)

Complete TypeScript source code of the BotValia CLI, reconstructed from source maps and **runnable locally**.

<img src="preview.png" width="380"/>

> [!WARNING]
> This repository is an **unofficial** version, reconstructed from the source map of the public npm release package. It is **for research and learning purposes only** and does not represent the internal development repository structure of Anthropic. Some modules have been replaced with compatible shims.

---

## Requirements

- Bun ≥ 1.3.5
- Node.js ≥ 24

## Quickstart

```bash
$ bun install       # Install dependencies
$ bun run dev:auto  # Start CLI with Auto (All)
$ bun run version   # Verify version number
```

### Free Routing Modes

BotValia now targets a free-first model strategy. The main entrypoint is:

```bash
bun run dev:auto
```

That launches **Auto (All)**, the recommended mode in `/model`.

Available launchers:

```bash
bun run dev:auto          # Auto (All)   -> OpenRouter + Ollama
bun run dev:auto:all      # same as above
bun run dev:auto:openrouter
bun run dev:auto:ollama
```

Startup-only checks:

```bash
bun run version:auto
bun run version:auto:all
bun run version:auto:openrouter
bun run version:auto:ollama
```

Smoke test del router:

```bash
bun run smoke:router:fallback
bun run smoke:router:fallback:json
```

Ese smoke no usa red. Valida tres cosas del fallback free:

- precedencia de `routeSpec` sobre `fallbackModels`
- deduplicación de la cadena de fallback
- cambio real del provider/modelo activo con `applyProviderRoute()` en cada salto

El REPL interactivo ahora usa la misma resolución rica de `routeSpec` y `fallbackRouteSpecs` que `QueryEngine`, en vez de quedarse sólo con `fallbackModels` planos.

#### Auto (All)

`Auto (All)` is a hybrid free router with three lanes:

- **Code**: coding and repo-scale work
- **General**: reasoning / agentic productivity
- **Fast**: lightweight prompts and quick loops

Each lane uses **1 primary model + multiple fallbacks**.

BotValia now does two extra things to keep free routing alive longer:

- It prioritizes the **live OpenRouter free catalog** detected at launch through `https://openrouter.ai/api/v1/models`.
- It prefers **models that are actually installed in Ollama** when the endpoint can answer `/api/tags`.
- It persists per-project cooldowns in `.claude/model-route-cooldowns.json`, so a route that just failed goes to the back of the queue for a while instead of being retried immediately next session.

Current default primaries are:

- Fast: `openrouter::google/gemma-4-26b-a4b-it:free`
- General: `openrouter::tencent/hy3-preview:free`
- Code: `openrouter::poolside/laguna-m.1:free`

Notable OpenRouter free fallbacks now include:

- Fast: `z-ai/glm-4.5-air:free`, `openai/gpt-oss-20b:free`, `nvidia/nemotron-nano-9b-v2:free`, `nvidia/nemotron-3-nano-30b-a3b:free`, `poolside/laguna-xs.2:free`, `google/gemma-3-12b-it:free`, `meta-llama/llama-3.2-3b-instruct:free`
- General: `openai/gpt-oss-120b:free`, `minimax/minimax-m2.5:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `inclusionai/ling-2.6-1t:free`, `z-ai/glm-4.5-air:free`, `openrouter/free`
- Code: `qwen/qwen3-coder:free`, `tencent/hy3-preview:free`, `openai/gpt-oss-120b:free`, `minimax/minimax-m2.5:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `openrouter/free`

Current Ollama-first primaries are:

- Fast: `ollama::gemma3:4b`
- General: `ollama::gpt-oss:20b`
- Code: `ollama::qwen3-coder:30b`

Notable Ollama fallbacks now include `qwen3:4b`, `llama3.2:3b`, `deepseek-r1:1.5b`, `qwen3:30b`, `deepseek-r1:14b`, `gemma3:12b`, `qwen2.5-coder:14b`, and `deepseek-coder-v2:16b`.

If only one provider is available, BotValia automatically collapses to same-provider routing.

#### OpenRouter Setup

1. Set your key:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-..."
```

2. Start BotValia:

```bash
bun run dev:auto:openrouter
```

3. Or use the hybrid mode:

```bash
bun run dev:auto
```

Useful helpers:

```bash
bun run models:openrouter:free
bun run model:openrouter:set -- -Model "tencent/hy3-preview:free"
bun run model:openrouter:clear
```

To rotate across multiple OpenRouter credentials, you can provide a pool:

```powershell
$env:BOTVALIA_OPENROUTER_API_KEYS = "sk-or-a...,sk-or-b...,sk-or-c..."
```

BotValia will automatically rotate that pool on credential/credit failures and
keep the free route chain moving. Important note: OpenRouter documents that
extra API keys/accounts do **not** increase their global rate limits, so the
biggest win from this pool is resilience against `401`/`402` key state issues,
not bypassing OpenRouter-wide free-tier throttling.

#### Ollama Setup

1. Start Ollama and pull the models you want, for example:

```bash
ollama pull gemma3:4b
ollama pull gpt-oss:20b
ollama pull qwen3-coder:30b
```

2. Run Ollama-only routing:

```bash
bun run dev:auto:ollama
```

3. Or let the hybrid router use Ollama as fallback:

```bash
bun run dev:auto
```

To use multiple Ollama or LiteLLM-compatible endpoints:

```powershell
$env:BOTVALIA_OLLAMA_ENDPOINTS = "http://localhost:11434|ollama;http://192.168.1.50:11434|ollama"
```

You can also use URL/key pools:

```powershell
$env:BOTVALIA_OLLAMA_BASE_URLS = "http://localhost:11434,http://192.168.1.50:11434"
$env:BOTVALIA_OLLAMA_API_KEYS = "ollama,ollama"
```

BotValia will rotate those endpoints on connection and availability failures
before giving up on the current Ollama route.

`/model` now exposes exactly four top-level options:

- `Auto (All)` recommended
- `Auto (OpenRouter)`
- `Auto (Ollama)`
- `Manual`

Inside `Manual`, BotValia opens a second list with fixed OpenRouter/Ollama models ordered by use-case (`Code`, `General`, `Fast`).
When BotValia can detect real availability at launch, that list is filtered/prioritized by:

- the live OpenRouter free catalog
- the actual Ollama inventory reported by the configured endpoint

Important note:

- `openrouter/free` is a router, not one fixed model.
- BotValia uses `openrouter/free` only as a late fallback/router, not as the preferred manual choice.
- Manual mode uses exact fixed models such as `openrouter::poolside/laguna-m.1:free` or `ollama::qwen3-coder:30b`.

### Real-Time Swarm Roadmap

There is now a technical implementation plan for turning the existing agent/team system into real-time collaborating subagents:

- [REALTIME_SWARM_PLAN.md](REALTIME_SWARM_PLAN.md)

Estado actual de Fase 1:

- `SendMessage` ya puede emitir `team_event` con `kind`, `thread_id`, `reply_to`, `topic` y `priority`
- el mailbox ya soporta envelope estructurado retrocompatible
- los mensajes estructurados ya se formatean para que no entren como JSON crudo al contexto del agente
- el runner in-process ya puede despertarse por escritura local al mailbox sin esperar siempre el sleep completo
- `useInboxPoller` ya combina polling con wakeup local para reaccionar antes a mensajes del mailbox en el mismo proceso
- la ruta headless de `print.ts` ya usa wakeup local del mailbox sin empeorar el caso donde ya había mensajes pendientes

Implementation note:

- OpenRouter and Ollama are both wired through Anthropic-compatible envs.
- Ollama compatibility follows the current `/v1/messages` Anthropic-compatible API.

### Infinite Memory (BotValia)

BotValia currently includes a practical low-token local memory pipeline:
- Short-term memory: sends only recent messages to the model.
- Long-term memory: persists interactions on disk per project.
- Semantic memory: stores **local hash embeddings** and injects relevant memories by similarity.

Storage (local project):
- `.botvalia/memory/interactions.json`
- `.botvalia/memory/vectors.json`
- `.botvalia/memory/summaries.json`
- `.botvalia/memory/state.json`

Important:

- The current semantic layer is cheap and local, but it is **not** a full vector database or true global “infinite memory”.
- Retrieval is currently lightweight JSON + cosine search over hash-based embeddings.
- There is a separate `memory_plugin/` prototype for a heavier local-memory path, but it is not the main runtime path today.

Environment toggles:
- `BOTVALIA_MEMORY_DISABLED=1` disables the memory optimization layer.
- `BOTVALIA_MEMORY_SHORT_TERM_LIMIT` default `10`
- `BOTVALIA_MEMORY_RELEVANT_TOP_K` default `5`
- `BOTVALIA_MEMORY_SUMMARY_TRIGGER` default `40`
- `BOTVALIA_MEMORY_SUMMARY_KEEP_RECENT` default `14`

### /init, Local Memory, and Activable UX/UI/QA

- `/init` is the best current onboarding command for a project.
- In the restored tree, `/init` always knows how to create or improve `CLAUDE.md`.
- When the `NEW_INIT` feature is enabled, or `CLAUDE_CODE_NEW_INIT=1` is set, `/init` can also scaffold `CLAUDE.local.md`, project skills, and hooks.
- `/memory` opens the currently discovered instruction files in your editor and, if auto-memory is enabled, can also open auto-memory, team-memory, and agent-memory folders.
- `/skills` lists bundled, plugin, user, and project skills available to the current session.

Current local instruction memory works like this:

1. Managed memory: system-level `CLAUDE.md`
2. User memory: `~/.claude/CLAUDE.md`
3. Project memory: `CLAUDE.md`, `.claude/CLAUDE.md`, and `.claude/rules/*.md`
4. Local memory: `CLAUDE.local.md`

Important details:

- Files closer to the current working directory override broader ones.
- Memory files support `@path` includes such as `@./notes.md`, `@~/common.md`, or `@/absolute/file.md`.
- `CLAUDE.local.md` is the right place for private endpoints, local test accounts, personal QA notes, or machine-specific workflow tweaks.

For activable specialist behavior today, the cleanest path is:

- **Skills** in `.claude/skills/<skill-name>/SKILL.md` for repeatable workflows you invoke with `/skill-name`
- **Per-session profiles** with `--append-system-prompt-file` when you want a lightweight UX/UI/QA mode without creating a full skill
- **Plugins** when you want opt-in bundles that ship multiple skills, hooks, and MCP config together

Recommended split:

- `ux-audit`: flows, copy, friction, navigation, edge cases
- `ui-polish`: spacing, hierarchy, states, accessibility, finish
- `qa-regression`: smoke checks, reproduction, verification evidence

Starter templates live in [UX_UI_QA_SKILLS.md](UX_UI_QA_SKILLS.md).

---

## Project Structure

```text
.
├── src/                # Core source code (~2,006 TS/TSX files)
│   ├── entrypoints/    # CLI entry points
│   ├── main.tsx        # Main initialization (auth / MCP / settings / feature flags)
│   ├── dev-entry.ts    # Development entry point
│   ├── QueryEngine.ts  # Core engine (~1,295 lines, LLM API loop, persistence)
│   │
│   ├── tools/          # Tool implementations (53 items: Bash, Read, Edit, Agent...)
│   ├── commands/       # Slash commands (87 items)
│   ├── services/       # Backend services (API, MCP, OAuth, telemetry/Datadog)
│   ├── utils/          # Utility functions (git, permissions, model, token budget)
│   │
│   ├── components/     # Terminal UI components (~406 files, React + Ink)
│   ├── hooks/          # Custom React Hooks
│   ├── ink/            # Ink terminal renderer (custom branch)
│   ├── vim/            # Vim mode engine
│   ├── keybindings/    # Keybindings
│   │
│   ├── coordinator/    # Multi-Agent orchestration and worker coordination
│   ├── bridge/         # IDE bidirectional communication & remote bridge control
│   ├── remote/         # Remote session teleportation & management
│   ├── server/         # IDE direct connection server
│   ├── skills/         # Reusable workflow & skill system
│   ├── plugins/        # Plugin system
│   ├── memdir/         # Persistent memory system (5-tier memory)
│   ├── voice/          # Voice interaction (streaming STT, unreleased)
│   ├── buddy/          # Gacha companion sprite system (Easter egg)
│   └── assistant/      # "KAIROS" always-running daemon mode (unreleased)
│
├── shims/              # Native module compatibility alternatives
├── vendor/             # Native binding source code
├── package.json
├── tsconfig.json
└── bun.lock
```

---

## Architecture

BotValia is built on top of a highly optimized and robust architecture designed for LLM API interaction, token efficiency, and advanced execution boundaries.

### Boot Sequence

```text
dev-entry.ts → entrypoints/cli.tsx → main.tsx → REPL (React/Ink)
  │                │          │
  │                │          └─ Full Initialization: Auth → GrowthBook (Feature Flags) → MCP → Settings → Commander.js
  │                └─ Fast Path: --version / daemon / ps / logs
  └─ Startup Gate: scans for missing relative imports; blocks boot until all resolve
```

### Core Engine & Token Optimization

Token efficiency is critical for survival in BotValia. The architecture employs industry-leading token saving techniques:
- **`QueryEngine.ts`**: The central engine (~1,295 lines) managing the LLM API loop, session lifecycle, and automatic tool execution.
- **3-Tier Compaction System**:
  1. **Microcompact**: Uses the `cache_edits` API to remove messages from the server cache without invalidating the prompt cache context (zero API cost).
  2. **Session Memory**: Uses pre-extracted session memory as a summary to avoid LLM calls during mid-level compaction.
  3. **Full Compact**: Instructs a sub-agent to summarize the conversation into a structured 9-section format, employing `<analysis>` tag stripping to reduce token usage while maintaining quality.
- **Advanced Optimizations**: 
  - `FILE_UNCHANGED_STUB`: Returns a brief 30-word stub for re-read files.
  - Dynamic max output caps (8K default with 64K retry) preventing slot-reservation waste.
  - Caching latches to prevent UI toggles limits (e.g., Shift+Tab) from busting 70K context.
  - Circuit breakers preventing wasted API calls on consecutive compaction failures.

### Harness Engineering (Permissions & Security)

The "Harness" safely controls LLM operations within the local environment:
- **Permission Modes**: Features 6 primary modes (`acceptEdits`, `bypassPermissions`, `default`, `dontAsk`, `plan`) plus internal designations like `auto` (yoloClassifier) and `bubble` (sub-agent propagation).
- **Security Checkers**: Incorporates PowerShell-specific security analysis to detect command injection, download cradles, and privilege escalation, as well as redundant path validations.
- **Architectural Bypasses**: Specific environments intentionally bypass checks (e.g., `CLAUDE_CODE_SIMPLE` clears system prompts), while failing schema parsing can inadvertently circumvent standard permissions.

### Teams & Multi-Agent Orchestration

- **Agents**: Orchestrated via `AgentTool`, created with three distinct paths: Teammate (tmux or in-process), Fork (inheriting context), and Normal (fresh context).
- **Coordinator Mode**: A designated coordinator delegates exact coding tasks to worker agents (`Agent`, `SendMessage`, `TaskStop`), effectively isolating high-level reasoning from raw file execution.

### Memory System (5-Tier Architecture)

Designed to persist AI knowledge across sessions and agents:
1. **Memdir**: Project-level indices and topic files (`MEMORY.md`).
2. **Auto Extract**: Fire-and-forget forked agent that consolidates memory post-session.
3. **Session Memory**: Real-time context tracking without extra LLM overhead.
4. **Team Memory**: Shared remote state leveraging SHA-256 delta uploads and git-leaks-based secret extraction guards.
5. **Agent Memory**: Agent-specific knowledge scoped to local, project, or user levels.

### Unreleased Subsystems & Future Directions

Hidden behind 88+ compile-time feature flags and 700+ GrowthBook runtime gates:
- **KAIROS**: An always-running background daemon featuring a "Dream" mode (autonomous memory consolidation during idle time).
- **Computer Use ("Chicago")**: macOS desktop control MCP (mouse, keyboard, screenshot capabilities).
- **Voice Mode**: Microphone control utilizing streaming STT.
- **ULTRAPLAN**: Capable of executing multi-agent planning over 30-minute CCR sessions.
- **Web Browser ("Bagel") & Teleport**: Integrated web navigation and remote session context teleportation.

### UI Architecture

Terminal UI based on **React + Ink**:

- `ink/` — Custom Ink branch (layout / focus / ANSI / virtual scrolling / click detection)
- `components/` (~406 files) — Messages, inputs, diffs, permission dialogs, status bar
- `hooks/` — Tools / voice / IDE / vim / sessions / tasks
- `vim/` — Full Vim keybinding engine (motions, operators, text objects)

---

## Reconstruction Notes

Source maps cannot 100% reconstruct the original repository. The following may be missing or degraded:

| Type | Description |
|------|-------------|
| **Type-only files** | Type-only `.d.ts` files may be missing |
| **Build artifacts** | Code generated during the build is not in the source map |
| **Native bindings** | Private native modules are replaced with `shims/` |
| **Dynamic resources** | Dynamic imports and resource files may be incomplete |

---

## Patches

This fork includes the following modifications from the original source:

| Patch | Description | Related Issue |
|-------|-------------|---------------|
| **Welcome banner toggle** | Added `showWelcomeBanner` setting to disable the startup banner (LogoV2). Set `"showWelcomeBanner": false` in `~/.claude/settings.json` to hide. | [#2254](https://github.com/anthropics/claude-code/issues/2254) |

---

## Disclaimer

- The source code copyright belongs to [Anthropic](https://www.anthropic.com).
- This is for technical research and learning purposes only. Please do not use it for commercial purposes.
