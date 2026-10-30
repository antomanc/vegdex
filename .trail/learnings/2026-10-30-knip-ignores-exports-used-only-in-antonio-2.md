---
title: Knip ignores exports used only in their own file and must run after typecheck
author: Antonio
date: 2026-10-30
branch: chore/e2e-json-preview-coverage-knip
cost: { minutes: 6, tokens: 53847 }
id: l-da1f8d37
scope: repo
status: active
replaces: l-44bcf762
src: agent
touches:
  - knip.json
  - ".github/workflows/ci.yml"
  - package.json
  - apps/web/vite.config.ts
  - apps/web/src/lib/data.ts
---

## Decided
knip runs in CI with ignoreExportsUsedInFile on, so 17 symbols exported but used only inside their own file stay exported. Only exports nothing uses at all are flagged (loadIngredients was deleted for that reason). The CLIs run through `tsx` from root package.json scripts are listed as entries because knip can't parse `pnpm --filter … exec tsx …`.

## Tried and ruled out
Stripping `export` from those 17 symbols: churn across many files for no behaviour change.

## Watch out
- CI runs `pnpm knip` after `pnpm typecheck`, because typecheck compiles apps/web/src/paraglide. Without that output, knip reports unresolved imports.
- knip loads apps/web/vite.config.ts from the repo root, so that config must read its files relative to import.meta.url, not cwd.
- Two dependencies are ignored because they load only at runtime: @inlang/plugin-message-format (through project.inlang/settings.json) and tsx in packages/mcp (`--import tsx` in its tests).

In the code: knip.json, .github/workflows/ci.yml, package.json "knip" script.
