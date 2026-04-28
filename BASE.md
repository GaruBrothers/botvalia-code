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
bun run dev
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

## Validation

```bash
bun run version
```

Document here any extra manual checks needed for the specific feature being worked on.
