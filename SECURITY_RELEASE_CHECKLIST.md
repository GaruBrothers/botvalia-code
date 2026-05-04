# Security Release Checklist

Last updated: 2026-05-03

This checklist is meant for maintainers preparing a public or semi-public release of BotValia Code.

It is intentionally operational. Use it as a gate before tagging a release, publishing a package, or sharing binaries more broadly.

This file does not replace [SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md). The roadmap explains what needs to be hardened over time. This checklist answers a different question:

> "Can this exact snapshot be released without exposing obvious identity, transcript, secret, or infrastructure risks?"

## Release Decision Levels

- `Blocked`: do not publish this snapshot
- `Needs explicit release note`: publish only if the risk is intentionally documented
- `Pass`: acceptable for the current OSS posture

## Phase 0. Repository Hygiene

### 0.1 Generated and local-only artifacts

- [ ] `Blocked` if generated `BotValia-CodeUI/.next/**` or other build artifacts are still tracked in Git
- [ ] `Blocked` if local cache, runtime output, or machine-specific files are about to be published unintentionally
- [ ] `Pass` if `.gitignore` covers UI build artifacts and tracked output was removed

### 0.2 Package and repo metadata

- [ ] `Blocked` if package metadata points to the wrong upstream repo or legacy project identity in a way that misleads users
- [ ] `Needs explicit release note` if legacy names still exist for compatibility in internal identifiers or env vars
- [ ] `Pass` if public-facing metadata identifies BotValia correctly

## Phase 1. Secrets and Sensitive Material

### 1.1 Source tree and docs

- [ ] `Blocked` if any live token, credential, cookie, or private endpoint secret is present in tracked files
- [ ] `Blocked` if screenshots, previews, or test fixtures expose account data, filesystem paths, or internal hosts that should not be public
- [ ] `Pass` if a final pass confirms no live secrets and only acceptable local path leakage remains

### 1.2 Transcript and feedback pathways

- [ ] `Blocked` if transcript-sharing or feedback pathways are active by default in OSS without explicit opt-in
- [ ] `Pass` if feedback and transcript sharing are default-off and clearly documented

## Phase 2. Network and Egress Review

Use [NETWORK_EGRESS.md](./NETWORK_EGRESS.md) as the inventory.

### 2.1 Nonessential outbound surfaces

- [ ] `Blocked` if nonessential telemetry, feedback, transcript share, or update checks are on by default
- [ ] `Pass` if those surfaces are default-off and require user opt-in

### 2.2 Auth and cloud endpoints

- [ ] `Needs explicit release note` if OAuth, MCP proxy, or cloud auth endpoints still target legacy Anthropic/Claude infrastructure
- [ ] `Blocked` if those flows are silently active in an OSS-facing default experience without documentation

### 2.3 Internal-only data export

- [ ] `Blocked` if internal-only export/upload flows are reachable in normal OSS usage without clear guarding
- [ ] `Needs explicit release note` if ant-only or enterprise-only code remains in tree but is still intentionally shipped

## Phase 3. Runtime and Local Transport

### 3.1 Runtime WebSocket bridge

- [ ] `Blocked` if the runtime WebSocket no longer requires authentication
- [ ] `Blocked` if the runtime bridge binds to non-loopback by default
- [ ] `Needs explicit release note` if auth remains query-token based rather than stronger per-request authorization
- [ ] `Pass` if it stays on `127.0.0.1` and enforces a token at connection time

### 3.2 Session mutation controls

- [ ] `Needs explicit release note` if any local client that knows the token can still read or mutate sessions without finer authorization
- [ ] `Pass` only for local single-user posture, not as a multi-user security claim

## Phase 4. Browser and UI Privacy

### 4.1 Local persistence

- [ ] `Blocked` if runtime URLs, ownership data, or session metadata are persisted longer than necessary in the browser by default
- [ ] `Pass` if runtime web metadata is session-scoped by default

### 4.2 UI/CLI channel ownership

- [ ] `Needs explicit release note` if UI and CLI channel ownership can still confuse users about where a message came from
- [ ] `Pass` if active channel semantics are visible and takeover is explicit

## Phase 5. Supply Chain and Dependencies

### 5.1 Audit results

- [ ] `Blocked` if there are unreviewed `high` or `critical` dependency vulnerabilities in runtime dependencies
- [ ] `Needs explicit release note` if a vulnerability is accepted temporarily with compensating controls
- [ ] `Pass` if audit findings are triaged and documented

### 5.2 Version pinning and drift

- [ ] `Needs explicit release note` if broad wildcard dependency ranges remain
- [ ] `Pass` if critical runtime dependencies are pinned or intentionally constrained

## Phase 6. Documentation and Disclosure

### 6.1 Security docs

- [ ] `Blocked` if `SECURITY.md` is missing or misleading about the current state
- [ ] `Pass` if `SECURITY.md`, `SECURITY_ROADMAP.md`, and release notes honestly describe current posture

### 6.2 User expectations

- [ ] `Needs explicit release note` if the build is still experimental, reconstructed, or compatibility-driven
- [ ] `Pass` if release notes clearly state whether the build is hardened, experimental, or best-effort

## Phase 7. Final Validation Pass

Run a final pass before publishing:

- [ ] `bun run version` succeeds
- [ ] `bun run security:preflight` succeeds
- [ ] runtime bridge still boots and rejects unauthenticated connections
- [ ] nonessential egress defaults are still off in OSS posture
- [ ] tracked generated artifacts are not reintroduced
- [ ] docs still match actual code behavior

## Minimum Publish Bar For This Repo

For this project's current maturity, a snapshot should not be called "secure for public release" unless all of the following are true:

- no obvious secret exposure in tracked content
- no tracked generated UI artifacts with local leakage
- nonessential egress remains default-off
- runtime bridge remains loopback-only and token-gated
- dependency audit findings are reviewed
- public docs honestly describe limitations

If one of those conditions fails, treat the release as:

- internal-only
- experimental
- or blocked pending remediation

## Sign-off Template

Use this at release time:

```text
Release candidate:
Reviewer:
Date:

Repository hygiene: Pass / Needs note / Blocked
Secrets review: Pass / Needs note / Blocked
Network egress review: Pass / Needs note / Blocked
Runtime local transport: Pass / Needs note / Blocked
Browser/UI privacy: Pass / Needs note / Blocked
Dependency review: Pass / Needs note / Blocked
Docs/disclosure: Pass / Needs note / Blocked

Overall decision:
Notes:
```
