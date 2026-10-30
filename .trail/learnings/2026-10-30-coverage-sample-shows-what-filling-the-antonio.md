---
title: "Coverage --sample shows what filling the largest gaps would cover, not a faster run on a subset"
author: Antonio
date: 2026-10-30
branch: chore/e2e-json-preview-coverage-knip
cost: { minutes: 17, tokens: 91710 }
id: l-c16a3b4f
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/ci.yml"
  - AGENTS.md
  - apps/web/src/lib/data.ts
  - apps/web/vite.config.ts
  - knip.json
  - package.json
  - pnpm-lock.yaml
  - playwright.config.ts
  - scripts/preview.mjs
  - docs/agents/vocabulary.md
---

## Decided
The user chose "fill payoff": `pnpm coverage --sample` adds one example line per listed gap and, per language and gap kind, how many lines the largest 10/25/50/100/250 gaps cover together (count and % of that kind's gap lines). Its purpose is sizing `pnpm gaps --size --batches`. Kinds are reported separately because batches are built per kind and language.

## Tried and ruled out
- `--sample N` scoring a random subset of recipes for a quicker run: not what the user wanted.
- Example lines plus a running total down the top list only: dropped in favour of per-kind cumulative sizes.

## Watch out
A full coverage run takes ~53 s, almost all of it walking the catalog. Compute gaps once and pass them to measureCoverage; don't call findGaps twice. A line can carry more than one gap, so percentages are of gap-line hits for that kind, not of distinct lines.

In the code: packages/ingest/src/vocab-cli.ts coverage() and PAYOFF_SIZES; measureCoverage(prepared, vocab, languages, gaps = findGaps(...)) in packages/ingest/src/gaps.ts.
