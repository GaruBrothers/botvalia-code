<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# BotValia Base

## Overview

Base Markdown template for documenting the `botvalia-code` repository.

## Project

- Name: `@botvalia/botvalia-code`
- Type: Reconstructed TypeScript CLI source tree
- Runtime: Bun `>=1.3.5`, Node.js `>=24`

## Purpose

Describe here what this project does, who it is for, and the main problem it solves.

## Quickstart

```bash
bun install
bun run dev:auto
bun run version
```

## Main Areas

- `src/`: core CLI source code
- `shims/`: compatibility replacements for native/private modules
- `vendor/`: native binding source code
- `scripts/`: helper scripts for local execution modes

## Notes

- `src/dev-entry.ts` blocks startup if relative imports are missing.
- This repository is reconstructed, so changes should stay minimal and auditable.
- Manual validation is preferred for each changed path.

## Model Routing

- `/model` top level: `Auto (All)`, `Auto (OpenRouter)`, `Auto (Ollama)`, `Manual`.
- `Auto (All)`: recommended hybrid free routing across OpenRouter and Ollama, organized by `Code`, `General`, and `Fast`.
- `Auto (OpenRouter)`: same-provider OpenRouter routing with multiple curated fallbacks per lane.
- `Auto (Ollama)`: same-provider Ollama routing with multiple curated fallbacks per lane.
- `Manual`: opens a second list with fixed models ordered by use-case (`Code`, `General`, `Fast`).
- `openrouter/free`: OpenRouter router for free models, not a fixed manual model.
- BotValia persists per-project route cooldowns in `.claude/model-route-cooldowns.json` so failed free routes go to the back of the queue between sessions.
- Launchers can query the live OpenRouter free catalog via `/api/v1/models` and prefer models that are actually free/visible there.
- Launchers can query Ollama inventory via `/api/tags` and prefer models that are actually installed.
- `BOTVALIA_OPENROUTER_API_KEYS`: comma-separated OpenRouter key pool for credential/credit failover.
- `BOTVALIA_OLLAMA_ENDPOINTS`: semicolon/comma-separated endpoint pool using `baseUrl|apiKey`.
- `BOTVALIA_OLLAMA_BASE_URLS` + `BOTVALIA_OLLAMA_API_KEYS`: alternate indexed pool format for Ollama/LiteLLM-compatible endpoints.

## Local Memory

- Current local memory is low-token and practical, not a full vector DB.
- Semantic retrieval uses local hash embeddings plus cosine similarity over project JSON files in `.botvalia/memory/`.
- There is a heavier `memory_plugin/` prototype in the repo, but it is not the main runtime path today.
- Instruction memory currently resolves in this order:
  1. managed `CLAUDE.md`
  2. user `~/.claude/CLAUDE.md`
  3. project `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`
  4. local `CLAUDE.local.md`
- Memory files support `@path` includes and files closer to the current working directory have higher priority.

## Onboarding And Profiles

- `/init` is the current onboarding command for generating or updating project instructions.
- With `NEW_INIT` enabled, `/init` can also scaffold `CLAUDE.local.md`, project skills, and hooks.
- `/memory` opens instruction files and memory folders in the configured editor.
- `/skills` lists bundled, plugin, user, and project skills available to the current session.
- The cleanest current specialization paths are:
  - project skills in `.claude/skills/<skill-name>/SKILL.md`
  - per-session prompt profiles via `--append-system-prompt-file`
  - plugins for enable/disable bundles
- Suggested activable workflows: `ux-audit`, `ui-polish`, `qa-regression`.
- Starter templates: [UX_UI_QA_SKILLS.md](UX_UI_QA_SKILLS.md)

## Validation

```bash
bun run version
bun run version:auto
```

Document here any extra manual checks needed for the specific feature being worked on.

