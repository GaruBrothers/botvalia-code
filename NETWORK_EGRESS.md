# Network Egress Inventory

Last updated: 2026-05-03

This document is a practical inventory of network and transport surfaces that matter when reviewing BotValia Code for an OSS-safe posture.

It complements [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md) and [SECURITY.md](./SECURITY.md). The roadmap tracks phases and debt; this file tracks what currently talks to the network, what is local-only, and what should stay off by default in a public build.

## Reading Guide

- `Local-only` means traffic is intended to remain on the same machine or browser session.
- `Default-off in OSS` means the current code path is blocked unless the user explicitly opts in.
- `Review before enabling` means the surface may still be legitimate, but should not be treated as safe-to-publish without checking the exact target and data shape.

## Current OSS Posture Summary

Current high-level posture:

- local runtime bridge is bound to `127.0.0.1`
- runtime WebSocket connections require a per-runtime auth token
- nonessential egress is blocked by default for feedback, transcript sharing, telemetry, and update checks
- internal `/insights` export/upload and remote collection are blocked by default unless maintainers opt in with internal env configuration
- some legacy and cloud-facing integrations still exist in code and must be reviewed before any public release

## Local-Only Transport Surfaces

### 1. Runtime WebSocket bridge

Primary files:

- [src/runtime/runtimeWsServer.ts](./src/runtime/runtimeWsServer.ts)
- [src/runtime/runtimeBridge.ts](./src/runtime/runtimeBridge.ts)
- [src/runtime/protocol.ts](./src/runtime/protocol.ts)

Current behavior:

- binds to `127.0.0.1` by default
- uses a per-runtime token
- rejects unauthenticated WebSocket handshakes
- carries session state, transcript inspection, mutation requests, and runtime events

Risk notes:

- auth token is still URL-derived rather than a stronger channel-binding model
- local malware or another local user context on the same machine may still be relevant depending on the environment
- the token is now removed from the visible browser URL after boot and no longer printed in normal `/runtime` user-facing output, but it still exists in the launch flow itself

Release stance:

- acceptable for local desktop/dev usage
- not sufficient to describe as "strong multi-tenant auth"

## Default-Off Nonessential Outbound Egress

Primary file:

- [src/utils/nonEssentialEgress.ts](./src/utils/nonEssentialEgress.ts)

The following surfaces are blocked by default in the OSS posture unless explicitly enabled:

### 2. Feedback submission

Primary files:

- [src/components/Feedback.tsx](./src/components/Feedback.tsx)
- [src/utils/nonEssentialEgress.ts](./src/utils/nonEssentialEgress.ts)

Default status:

- default-off in OSS

Opt-in controls:

- `BOTVALIA_ENABLE_FEEDBACK_SUBMISSION=1`
- `BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1`
- `OSS_SAFE_MODE=0`

Data sensitivity:

- user-written report text
- environment metadata
- session transcript
- git repo metadata
- sanitized error logs

### 3. Transcript sharing

Primary files:

- [src/components/FeedbackSurvey/submitTranscriptShare.ts](./src/components/FeedbackSurvey/submitTranscriptShare.ts)
- [src/utils/nonEssentialEgress.ts](./src/utils/nonEssentialEgress.ts)

Default status:

- default-off in OSS

Opt-in controls:

- `BOTVALIA_ENABLE_TRANSCRIPT_SHARE=1`
- `BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1`
- `OSS_SAFE_MODE=0`

Data sensitivity:

- normalized transcript
- subagent transcripts
- raw JSONL transcript when below size guard

### 4. Nonessential telemetry

Primary files:

- [src/utils/nonEssentialEgress.ts](./src/utils/nonEssentialEgress.ts)
- telemetry pathways under `src/services/analytics/`

Default status:

- default-off in OSS

Opt-in controls:

- `CLAUDE_CODE_ENABLE_TELEMETRY=1`
- `BOTVALIA_ENABLE_NONESSENTIAL_TELEMETRY=1`
- `BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1`
- `OSS_SAFE_MODE=0`

### 5. Update checks and release-note fetches

Primary files:

- [src/utils/releaseNotes.ts](./src/utils/releaseNotes.ts)
- [src/utils/nonEssentialEgress.ts](./src/utils/nonEssentialEgress.ts)

Default status:

- default-off in OSS

Opt-in controls:

- `BOTVALIA_ENABLE_UPDATE_CHECKS=1`
- `BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1`
- `OSS_SAFE_MODE=0`

Targets when enabled:

- GitHub changelog pages and raw content endpoints

## Review-Before-Enabling Outbound Surfaces

These are the main surfaces that should be treated as explicit review points before any public release.

### 6. OAuth and cloud auth endpoints

Primary file:

- [src/constants/oauth.ts](./src/constants/oauth.ts)

Current behavior:

- production defaults still point at legacy provider-hosted endpoints
- staging and local variants also exist
- MCP proxy URLs are defined here too
- there is an allowlist for custom OAuth base URLs

Why this matters:

- these are first-class auth surfaces
- even if not used by every OSS user, they represent outbound identity and token flows

Release stance:

- review before enabling in a public binary
- document clearly if left intact for compatibility

### 7. Insights export and internal remote collection

Primary file:

- [src/commands/insights.ts](./src/commands/insights.ts)

Observed behaviors in code:

- internal-only remote collection through `coder`, `ssh`, and `scp`
- internal-only upload path and internal frontend URL generation
- these paths are now default-off in OSS posture unless maintainers opt in with `BOTVALIA_ENABLE_INTERNAL_INSIGHTS=1` plus the required internal env configuration

Why this matters:

- even though the default posture is now much safer, this is still cloud-facing and identity-sensitive behavior in the tree once re-enabled

Release stance:

- review before enabling
- strongly consider stripping, feature-flagging, or documenting as unavailable in OSS builds

## Browser Persistence and Data Lifetime

Primary files:

- [BotValia-CodeUI/hooks/useRuntimeInspector.ts](./BotValia-CodeUI/hooks/useRuntimeInspector.ts)
- [BotValia-CodeUI/lib/runtime-session-ownership.ts](./BotValia-CodeUI/lib/runtime-session-ownership.ts)

Current behavior:

- runtime metadata is now session-scoped rather than long-term local persistence by default
- launch-time runtime token data is cleared from the visible browser URL after boot and kept in session-scoped browser state instead

Why it matters:

- this reduces accidental retention of local runtime URLs and session ownership hints
- it is a privacy control, even though it is not itself network egress

## Practical Release Rules

Use this file with a simple rule set:

1. local-only bridges are allowed only if bound to loopback and authenticated
2. nonessential egress stays off by default in OSS
3. every enabled outbound surface must name its destination and data class
4. every auth or transcript-bearing flow must be called out in release notes or security docs

## Quick Questions Maintainers Should Ask

Before enabling any currently blocked or legacy surface, answer:

1. What exact host does it call?
2. Is the feature essential for a local OSS user?
3. Does it send transcript, repo, token, or identity data?
4. Is there an explicit opt-in?
5. Is the destination described publicly in docs?
6. Can the same value be delivered locally without egress?

If any answer is unclear, treat the surface as default-off until resolved.
