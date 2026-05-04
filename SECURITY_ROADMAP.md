<!-- IA-SYSTEM-PROTECTION:BEGIN -->
> **REGLA OBLIGATORIA PARA CUALQUIER IA**
>
> Ningun agente de IA, incluyendo Codex, Claude, ChatGPT, Gemini o similares, puede modificar, mover, borrar, instalar, desinstalar o intervenir archivos del sistema Windows, navegadores, perfiles de navegador, extensiones, complementos, configuraciones del equipo ni otros recursos fuera de este proyecto sin permiso explicito y especifico del usuario.
>
> Si el usuario no lo pide de forma explicita y puntual, se asume prohibido.
<!-- IA-SYSTEM-PROTECTION:END -->
# BotValia Code Security Roadmap

Last updated: 2026-05-03  
Repository: `botvalia-code`

## Executive Summary

BotValia Code is now **materially safer than the previous snapshot**, but it is still **not ready to be presented as a production-hardened open-source release**.

The biggest security improvements now verifiably in place are:

- `BotValia-CodeUI/.next/**` is no longer tracked in Git.
- The local runtime WebSocket now requires a **per-runtime auth token** at connection time.
- The runtime web UI no longer persists runtime URL, ownership metadata, and drafts in `localStorage`; that data now lives in `sessionStorage` and scopes out the token-bearing query string.
- The runtime launch token is no longer shown in the visible browser URL after the runtime web UI boots, and `/runtime` user-facing output now prints a sanitized launch URL.
- Feedback submission, transcript sharing, nonessential telemetry, background update checks, and changelog fetches are now **disabled by default** in OSS mode unless users explicitly opt in.
- Internal `/insights` remote collection and upload paths are now **disabled by default** in OSS mode unless maintainers explicitly opt in with internal env configuration.
- Public package metadata now points to the BotValia repository instead of the legacy Anthropic upstream.
- Direct `package.json` dependencies and devDependencies that previously used broad wildcard ranges were pinned to concrete versions from the current lockfile snapshot.
- A repo-level [SECURITY.md](./SECURITY.md) now exists.
- Maintainer-facing release docs now exist in [NETWORK_EGRESS.md](./NETWORK_EGRESS.md) and [SECURITY_RELEASE_CHECKLIST.md](./SECURITY_RELEASE_CHECKLIST.md).
- A local `bun run security:preflight` check and a baseline GitHub Actions security-preflight workflow now exist.

The main release blockers that still remain are:

- OAuth, MCP, and other cloud-oriented paths still reference Anthropic/Claude infrastructure in executable code and compatibility layers.
- Runtime auth is improved, but the bridge is not yet hardened with per-operation authorization beyond the WebSocket handshake and the runtime token still originates from a launch URL flow.
- Public docs and product surface still contain legacy/Anthropic assumptions in various places.
- There is still no dedicated private security contact or advisory workflow in-tree.

## What Was Verified In This Update

The statements in this document were checked directly against the current working tree on 2026-05-03.

Validation executed:

- `bun run version`
- `bun run security:preflight`
- `git ls-files "BotValia-CodeUI/.next/**"`
- `cd BotValia-CodeUI && npx tsc --noEmit`
- `bun audit`
- Runtime auth smoke test:
  - authenticated client can connect with the generated runtime URL
  - unauthenticated client is rejected when the token is omitted
- OSS-safe defaults smoke test:
  - feedback disabled by default
  - transcript sharing disabled by default
  - telemetry disabled by default
  - update checks disabled by default

Observed results:

- `git ls-files "BotValia-CodeUI/.next/**"` returned no tracked files.
- `BotValia-CodeUI` typecheck passed.
- `security:preflight` passed.
- Runtime auth smoke returned:
  - `runtimeAuthWorks: true`
- OSS-safe default smoke returned:
  - `feedbackEnabled: false`
  - `transcriptEnabled: false`
  - `telemetryEnabled: false`
  - `updatesEnabled: false`
- `bun audit` now returns:
  - no vulnerabilities found
- `security:preflight` now reports:
  - `local-path-leaks: pass`
  - `legacy-cloud-endpoints: warn`
  - `working-tree-cleanliness: pass` when the tree is clean

## Current Risk Snapshot

### Verified improvements

- Runtime WS handshake auth now exists in:
  - `src/runtime/protocol.ts`
  - `src/runtime/runtimeWsServer.ts`
  - `src/runtime/runtimeWsClient.ts`
- OSS-safe network defaults now exist in:
  - `src/utils/nonEssentialEgress.ts`
  - `src/components/Feedback.tsx`
  - `src/components/FeedbackSurvey/submitTranscriptShare.ts`
  - `src/utils/telemetry/bigqueryExporter.ts`
  - `src/services/analytics/config.ts`
  - `src/utils/releaseNotes.ts`
  - `src/utils/config.ts`
- Internal insights gating now defaults off in:
  - `src/commands/insights.ts`
- Runtime web persistence was reduced and normalized in:
  - `BotValia-CodeUI/hooks/useRuntimeInspector.ts`
  - `BotValia-CodeUI/lib/runtime-client.ts`
  - `BotValia-CodeUI/lib/runtime-session-ownership.ts`
  - `BotValia-CodeUI/lib/runtime-browser-storage.ts`
  - `BotValia-CodeUI/lib/runtime-url.ts`
- Public metadata/packaging cleanup is visible in:
  - `package.json`
  - `.gitignore`

### Still open

- OAuth constants and MCP/cloud flows still target Anthropic/Claude-operated domains in files such as:
  - `src/constants/oauth.ts`
  - bridge and auth pathways under `src/bridge/` and `src/utils/auth*`
- Runtime bridge auth is still only as strong as secrecy of the generated URL/token.
- Direct dependency pinning is improved, but audit remediation and transitive-dependency review are still open.
- Public docs and some UX/help paths still need a full OSS identity and infrastructure pass.

## Findings That Still Block A "Security-Hardened OSS" Claim

### 1. Supply-chain posture is still not release-grade

Verified state:

- `bun audit` now returns no vulnerabilities on the current lockfile snapshot.
- Direct runtime and developer dependencies in `package.json` are now pinned to explicit versions.
- Targeted `overrides` are now present for high-value transitive packages.

Why it matters:

- Reproducibility is better than before, but still depends on continued lockfile discipline and intentional upgrades.
- The current audit is clean, but future transitive drift can reintroduce risk if pins or overrides are relaxed carelessly.

Current status:

- Audit rerun: verified
- Metadata cleanup: improved
- Direct dependency pinning: improved
- Current vulnerability set: resolved on this snapshot

### 2. Legacy external infrastructure references remain in code

Verified examples still present:

- `src/constants/oauth.ts`
- `src/commands/insights.ts`
- multiple auth/bridge/cloud helpers under `src/bridge/` and `src/utils/`

Why it matters:

- The repository is safer by default now, but the codebase still contains legacy external service assumptions.
- This creates confusion for contributors and increases the chance of accidental re-enablement of nonessential traffic.

Current status:

- Safe-by-default egress posture: improved
- Full external-surface sanitization: pending

### 3. Runtime bridge auth is improved, but not yet final-form

Verified state:

- `src/runtime/runtimeWsServer.ts` generates and validates a per-runtime token in the WebSocket URL.
- `src/runtime/runtimeWsClient.ts` understands the authenticated runtime URL.
- Browser storage scope strips the token-bearing query string before persisting ownership metadata.
- User-facing `/runtime` output now prints a sanitized launch URL rather than echoing the full tokenized launch string.

Why it still matters:

- The runtime token still travels in a URL.
- A local process that gains the runtime URL during the lifetime of the session can still use the bridge.
- Authorization is still primarily connection-level, not a richer per-operation or per-session trust model.

Current status:

- Handshake auth: resolved for this phase
- Stronger runtime trust model: pending

### 4. Public OSS posture is better, but not fully sanitized

Verified improvements:

- `package.json` repository/homepage/bugs now point at BotValia.
- `.next` artifacts are no longer tracked.
- `SECURITY.md` exists.

Still pending:

- Review `README.md`, help text, comments, and ancillary docs for legacy Anthropic/Claude wording where it should not ship.
- Audit org-specific or maintainer-private assumptions in commands like `insights`, bridge flows, and docs.

## Phase Status

| Phase | Goal | Status | Verified notes |
|---|---|---|---|
| Phase 0 | Public release freeze and cleanup | Partial | `.next` untracked, package metadata fixed, `SECURITY.md` added, release checklist added. Full doc/help/brand sanitization still pending. |
| Phase 1 | Network egress and privacy hardening | Partial | Feedback, transcript share, telemetry, update checks, and release-note fetch are now OSS-safe by default. `NETWORK_EGRESS.md` exists, but legacy cloud/OAuth paths still exist in code. |
| Phase 2 | Runtime and local IPC hardening | Partial | Runtime WebSocket now requires a per-runtime token at handshake. Token still rides in the runtime URL and there is no deeper auth model yet. |
| Phase 3 | Dependency and supply-chain hardening | Partial | Direct dependency ranges are pinned, targeted overrides are in place, and `bun audit` is currently clean. Ongoing lockfile discipline and future upgrade review still remain. |
| Phase 4 | Product surface sanitization for OSS | Partial | Public package metadata is fixed, but docs/help/code surface still need a broader legacy-infrastructure cleanup. |
| Phase 5 | Secure data handling and consent | Partial | Browser persistence now uses `sessionStorage`, not `localStorage`, for runtime metadata. Transcript export still relies on best-effort redaction and cloud endpoints remain in code. |
| Phase 6 | Security assurance before public scale | Partial | `SECURITY.md`, `NETWORK_EGRESS.md`, `SECURITY_RELEASE_CHECKLIST.md`, `security:preflight`, and a baseline CI workflow now exist, but there is still no dedicated private inbox or advisory flow. |

## Phase-by-Phase Detail

### Phase 0 - Public Release Freeze and Cleanup

Status: **partial**

Resolved now:

- Stop tracking generated `BotValia-CodeUI/.next/**` output.
- Fix `package.json` repository metadata to point at BotValia-owned URLs.
- Expand `.gitignore` to cover local env files, keys, DB/session state, and generated runtime artifacts.
- Add a maintainer-facing release checklist in `SECURITY_RELEASE_CHECKLIST.md`.

Still pending:

- Sweep `README.md`, onboarding copy, and public docs for remaining legacy references and release-hosting assumptions.
- Keep the release checklist aligned as more surfaces are hardened or deprecated.

### Phase 1 - Network Egress and Privacy Hardening

Status: **partial**

Resolved now:

- Default-OSS opt-out behavior exists for:
  - feedback submission
  - transcript sharing
  - nonessential telemetry
  - background update checks
  - release-note/changelog fetches
- Internal `/insights` export/upload and remote collection now require explicit internal opt-in and env configuration.
- Opt-in envs now exist for those surfaces.
- A contributor-facing outbound inventory now exists in `NETWORK_EGRESS.md`.

Still pending:

- Audit and gate additional nonessential remote paths beyond the surfaces above.
- Review whether some bridge/cloud features should be explicitly disabled or hidden in OSS mode.

### Phase 2 - Runtime and Local IPC Hardening

Status: **partial**

Resolved now:

- WebSocket connections to the local runtime require the generated runtime token.
- Browser-side runtime persistence no longer stores the token-bearing URL in `localStorage`.

Still pending:

- Decide whether mutation requests should also require stronger channel/session authorization semantics.
- Consider auth rotation, shorter-lived secrets, or non-URL transport for the token.
- Harden any future remote/browser embedding path that might expose the runtime URL.

### Phase 3 - Dependency and Supply-Chain Hardening

Status: **partial**

Resolved now:

- Replace broad direct dependency wildcards in `package.json` with explicit versions aligned to the current lockfile snapshot.
- Upgrade direct vulnerable dependencies such as `axios`, `@anthropic-ai/sdk`, and `lodash-es`.
- Add targeted `overrides` for vulnerable transitive packages used through upstream SDKs.
- Re-run `bun audit` until the current lockfile snapshot is clean.

Still pending:

- Add CI gates for:
  - dependency audit
  - generated-file policy
  - secret scanning
  - lockfile integrity
- Keep verifying that the current override set is still necessary and remove it once upstream packages catch up.
- Consider SBOM generation and signed release artifacts.

### Phase 4 - Product Surface Sanitization for OSS

Status: **partial**

Resolved now:

- Public package metadata now references BotValia instead of the Anthropic upstream repo.

Still pending:

- Remove or rewrite legacy endpoint/help/docs references where they are no longer appropriate.
- Review internal-only workflows such as `insights` and remote-host collection logic before presenting this repo broadly.
- Decide what legacy compatibility names remain intentionally for interoperability versus what should disappear from public UX.

### Phase 5 - Secure Data Handling and Consent

Status: **partial**

Resolved now:

- Runtime web state is now session-scoped instead of persisting across browser restarts by default.
- Ownership storage scope no longer keys off the full token-bearing runtime URL.

Still pending:

- Treat transcript export as a more explicit consent boundary with clearer destination/retention messaging.
- Document retention behavior for session files, logs, feedback artifacts, and runtime metadata.
- Decide whether drafts/notes should support an explicit ephemeral mode.

### Phase 6 - Security Assurance Before Public Scale

Status: **partial**

Resolved now:

- A repo-level `SECURITY.md` exists and points to this roadmap.
- Maintainer-facing docs now include `NETWORK_EGRESS.md` and `SECURITY_RELEASE_CHECKLIST.md`.
- A local `security:preflight` command now exercises key OSS-safe checks.
- A baseline GitHub Actions workflow now runs the preflight on `push` and `pull_request`.

Still pending:

- Publish a private reporting path or enable GitHub private vulnerability reporting.
- Define a threat model for:
  - local runtime bridge
  - browser inspector
  - tool execution
  - transcript export
  - plugin / MCP ecosystem
- Add release-time security signoff criteria.

## Immediate Next Steps

The next security sprint should focus on these items in order:

1. Sanitize remaining public docs/help/legacy endpoint assumptions.
2. Decide whether the runtime token should move off the raw URL or gain stronger per-operation authorization semantics.
3. Add CI security gates and lockfile/sbom policy.
4. Establish a private vulnerability reporting path and advisory workflow.
5. Periodically re-run `bun audit` and validate that overrides can be reduced instead of growing indefinitely.

## Current Open-Source Readiness Call

If the question is:

> "Can I safely show this as open source today?"

The honest answer is:

- **Yes, it is meaningfully safer than before and no longer exposes some of the most obvious accidental leaks by default.**
- **No, it is still not ready to claim strong open-source security posture or production-grade hardening, mainly because legacy cloud integration and product-surface sanitization still remain.**

That is the line maintainers should communicate until Phase 3 and the remaining surface-sanitization work are complete.

