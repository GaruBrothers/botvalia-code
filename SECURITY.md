<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# Security Policy

Last updated: 2026-05-03

## Current Project Status

This repository is still an experimental and reconstructed codebase. It is **not yet presented as a production-hardened open-source release**.

Current hardening that is now in place:

- runtime WebSocket connections require a per-runtime auth token
- nonessential feedback, transcript sharing, telemetry, and background update checks are disabled by default in the OSS posture unless users opt in
- internal `/insights` export and remote collection paths are disabled by default in the OSS posture unless maintainers opt in with explicit internal env configuration
- runtime web metadata is session-scoped in the browser instead of being persisted long-term by default, and the launch token is stripped from the visible browser URL after startup
- generated `BotValia-CodeUI/.next/**` artifacts are no longer tracked in Git
- a local `bun run security:preflight` check now exists to catch common OSS-release mistakes before publishing
- the current `bun audit` snapshot is clean after direct dependency upgrades and targeted transitive overrides
- the security preflight now distinguishes real maintainer-local path leaks from generic Windows path examples, and it narrows legacy-cloud warnings to executable endpoints plus compatibility mentions

Before reporting a vulnerability, please read:

- [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md)
- [NETWORK_EGRESS.md](./NETWORK_EGRESS.md)
- [SECURITY_RELEASE_CHECKLIST.md](./SECURITY_RELEASE_CHECKLIST.md)

Maintainers should also run:

- `bun run security:preflight`

That roadmap is the source of truth for what is currently verified as resolved, partially resolved, or still pending.
The egress inventory explains what still talks to the network and why. The release checklist is the maintainer-facing gate for deciding whether a snapshot should ship at all.

## Supported Versions

There is no stable supported release line yet.

Current support posture:

- `main` / current working tree: best-effort only
- historical commits: unsupported
- packaged/public binaries derived from older snapshots: unsupported unless explicitly documented otherwise

If a security fix lands, expect it to land on the current branch first rather than being backported broadly.

## How To Report A Vulnerability

### Please do not open a public issue first for sensitive bugs

For bugs involving any of the following, avoid public disclosure until a maintainer has had a chance to assess them:

- credential exposure
- transcript leakage
- auth bypass
- runtime WebSocket takeover
- arbitrary command execution
- sandbox escape
- cross-session data exposure

### Current reporting reality

This repository does **not yet publish a dedicated private security inbox in-tree**.

Until a formal private channel exists, use the most private maintainer contact path available to you and request a private disclosure route first. If you do **not** have a private channel, open a minimal issue that:

- states that you need a private reporting path
- does **not** include exploit steps, secrets, tokens, or full proof-of-concept payloads

If GitHub private vulnerability reporting is enabled for the repo in the future, that should become the preferred path and this file should be updated.

## What To Include In A Report

Please include as much of the following as you can safely share:

- affected commit, branch, or package version
- operating system and terminal/browser context
- whether the issue is local-only, same-host, or remotely reachable
- exact feature area
  - runtime bridge
  - BotValia-CodeUI
  - feedback/transcript export
  - OAuth / auth
  - plugin loading
  - shell / tools / swarm
- reproduction steps
- expected vs actual behavior
- security impact
- whether sensitive data was accessed, modified, or exfiltrated
- any mitigation you already tested

## Scope Areas That Deserve Extra Care

High-value areas in this repo include:

- `src/runtime/`
- `BotValia-CodeUI/`
- `src/components/Feedback*`
- `src/utils/telemetry/`
- `src/constants/oauth.ts`
- tool execution and shell pathways under `src/tools/`
- plugin and MCP integration pathways under `src/services/` and `src/hooks/`

## Disclosure Expectations

Our current preference is coordinated disclosure:

1. report privately if possible
2. allow maintainers time to reproduce and triage
3. agree on a fix window if the issue is real
4. publish details only after a mitigation or explicit maintainer acknowledgement

Because this repo is not yet fully hardened for public OSS use, some findings may be documented first as roadmap debt rather than shipped as immediate fixes. When that happens, the expectation is still to avoid dropping active exploit details publicly before maintainers can respond.

## Maintainer Follow-up Needed

This file is intentionally honest about current gaps. Maintainers should still add:

- a dedicated security contact
- a private advisory workflow
- a threat model
- CI security gates

Those items remain tracked in [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md).

