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
$ bun run dev       # Start CLI (Interactive)
$ bun run version   # Verify version number
```

### Free Model Mode (Ollama + LiteLLM)

This repo can run against a custom Anthropic-compatible base URL, so you can use local/free models.

1. Start Ollama with a local model (example: `llama3.2:3b`).
2. Start LiteLLM proxy using [scripts/litellm.free.example.yaml](scripts/litellm.free.example.yaml), for example:
```bash
litellm --config scripts/litellm.free.example.yaml --port 4000
```
3. Run BotValia in free mode:
```bash
bun run dev:free
```

Optional:
- `bun run version:free` to verify startup with free-mode env vars.
- Override defaults:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-free.ps1 -BaseUrl "http://localhost:4000" -Model "ollama/llama3.2:3b" -ApiKey "sk-local"
```

### OpenRouter Mode

1. Set your API key in PowerShell:
```powershell
$env:OPENROUTER_API_KEY = "sk-or-..."
```
2. Start BotValia with OpenRouter:
```bash
bun run dev:openrouter
```

To list currently available free models from your account:
```bash
bun run models:openrouter:free
```

To pin one model (fixed across sessions until you change it):
```bash
bun run model:openrouter:set -- -Model "openai/gpt-oss-20b:free"
```

To remove pinned mode and return to auto selection:
```bash
bun run model:openrouter:clear
```

BotValia quality router (enabled by default in `dev:openrouter`):
- Coding/debug prompts -> `openai/gpt-oss-120b:free`
- General/light prompts -> `minimax/minimax-m2.7:cloud`
- Coding fallback chain -> `minimax/minimax-m2.7:cloud`, then `kimi/kimi-k2:free`, then `openai/gpt-oss-20b:free`
- General fallback chain -> `kimi/kimi-k2:free`, then `openai/gpt-oss-20b:free`

Override examples:
```powershell
$env:BOTVALIA_MODEL_ROUTER_ENABLED = "1"
$env:BOTVALIA_MODEL_ROUTER_CODE_MODEL = "openai/gpt-oss-120b:free"
$env:BOTVALIA_MODEL_ROUTER_FAST_MODEL = "minimax/minimax-m2.7:cloud"
$env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS = "minimax/minimax-m2.7:cloud,kimi/kimi-k2:free,openai/gpt-oss-20b:free"
$env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS = "kimi/kimi-k2:free,openai/gpt-oss-20b:free"
```

Optional:
- Verify startup only: `bun run version:openrouter`
- Free + fast is now the default behavior in `dev:openrouter`:
  - Preset: `free-fast`
  - Output tokens: `2048`
  - Thinking tokens: `512`
  - Auto-selects a `:free` model from OpenRouter model list, prioritizing lightweight options first.
  - If a pinned model exists, it is used first and does not rotate automatically.
- Override preset/model/base URL:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-openrouter.ps1 -Preset "free-fast" -BaseUrl "https://openrouter.ai/api" -ApiKey "sk-or-..." -MaxOutputTokens 2048 -MaxThinkingTokens 512
```
- Customize free-model priority order:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-openrouter.ps1 -Preset "free-fast" -PreferredFreeModels @("liquidai/lfm2.5-1.2b-instruct:free","google/gemma-3n-2b:free","openai/gpt-oss-20b:free")
```
- Force OpenRouter automatic routing:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-openrouter.ps1 -Preset "auto"
```
- Force a specific model:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/dev-openrouter.ps1 -Preset "custom" -Model "google/gemma-3-4b-it:free"
```

Note:
- This mode uses Anthropic-compatible envs for OpenRouter:
  - `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
  - `ANTHROPIC_AUTH_TOKEN=<OPENROUTER_API_KEY>`
  - `ANTHROPIC_API_KEY` is intentionally cleared.

### Infinite Memory (BotValia)

BotValia now includes a 3-layer memory pipeline:
- Short-term memory: sends only recent messages to the model.
- Long-term memory: persists interactions on disk per project.
- Semantic memory: stores embeddings and injects relevant memories by similarity.

Storage (local project):
- `.botvalia/memory/interactions.json`
- `.botvalia/memory/vectors.json`
- `.botvalia/memory/summaries.json`
- `.botvalia/memory/state.json`

Environment toggles:
- `BOTVALIA_MEMORY_DISABLED=1` disables the memory optimization layer.
- `BOTVALIA_MEMORY_SHORT_TERM_LIMIT` default `10`
- `BOTVALIA_MEMORY_RELEVANT_TOP_K` default `5`
- `BOTVALIA_MEMORY_SUMMARY_TRIGGER` default `40`
- `BOTVALIA_MEMORY_SUMMARY_KEEP_RECENT` default `14`

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
