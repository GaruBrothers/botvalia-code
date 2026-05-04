<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# UX / UI / QA Skills

This guide shows the cleanest current way to make specialist behavior activable in BotValia without changing core routing code.

## Use Two Layers

- Use **skills** when you want a reusable workflow you can invoke with `/skill-name`.
- Use **per-session prompt profiles** when you want a lighter temporary mode for the current run only.

## Project Skills

Project skills live in:

```text
.claude/skills/<skill-name>/SKILL.md
```

They show up in `/skills` and can be invoked directly, for example:

```text
/ux-audit
/ui-polish
/qa-regression
```

### Example: `ux-audit`

```md
---
name: ux-audit
description: Review flows, friction, copy, and edge cases before implementation or release
---

Act as a UX reviewer.

Focus on:
- task flow clarity
- navigation and discoverability
- empty, loading, and error states
- copy clarity and user friction

When reviewing, return:
1. top UX risks
2. concrete fixes
3. any missing states or edge cases
```

### Example: `ui-polish`

```md
---
name: ui-polish
description: Push a UI from functional to polished, accessible, and visually intentional
---

Act as a UI implementation reviewer.

Focus on:
- spacing rhythm and visual hierarchy
- typography, contrast, and alignment
- component states: hover, focus, disabled, loading
- responsive behavior and accessibility

Prefer specific edits over generic design advice.
```

### Example: `qa-regression`

```md
---
name: qa-regression
description: Run a pragmatic regression pass and capture validation evidence
---

Act as a QA pass.

Focus on:
- reproduction steps
- smoke checks around the changed path
- likely regressions near the touched feature
- validation evidence: commands run, scenarios checked, gaps remaining

Return findings first, then residual risks.
```

## Per-Session Profiles

For a lighter temporary mode, create a markdown file anywhere and start BotValia with:

```bash
bun run dev:auto -- --append-system-prompt-file .\ux.profile.md
```

### Example `ux.profile.md`

```md
Prioritize UX clarity over implementation speed.
Call out friction, missing states, copy issues, and confusing flows.
Prefer small iterative fixes with explicit tradeoffs.
```

### Example `ui.profile.md`

```md
Prioritize visual polish, hierarchy, responsive layout, and accessibility.
Be opinionated about spacing, typography, alignment, and component states.
Avoid generic UI patterns when a stronger design direction is possible.
```

### Example `qa.profile.md`

```md
Prioritize verification and regression prevention.
List findings before summaries.
Always mention what was validated, what was not validated, and remaining risk.
```

## Which One To Choose

- Choose a **skill** when the workflow is repeatable and deserves a slash command.
- Choose a **profile file** when you only need to bias one session.
- Keep private/local-only preferences in `CLAUDE.local.md`.

