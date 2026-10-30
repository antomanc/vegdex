---
title: "Coverage --sample shows what filling the largest gaps would cover, not a faster run on a subset"
author: Antonio
date: 2026-10-30
branch: chore/e2e-json-preview-coverage-knip
cost: { minutes: 6, tokens: 53847 }
id: l-917daafb
scope: repo
status: active
replaces: l-c16a3b4f
src: agent
touches:
  - packages/ingest/src/vocab-cli.ts
  - packages/ingest/src/gaps.ts
  - packages/ingest/test/vocab.test.ts
  - docs/agents/vocabulary.md
---

## Decided
The user chose "fill payoff": `pnpm coverage --sample` adds one example line per listed gap and, per language and gap kind, how many gap lines the largest 10/25/50/100/250 gaps cover together, then all of them (count and % of that kind's gap lines). Its purpose is sizing `pnpm gaps --size --batches`. Kinds are reported separately because batches are built per kind and language. The flag keeps the name `--sample` because the user asked for it by that name.

## Tried and ruled out
- `--sample N` scoring a random subset of recipes for a quicker run: not what the user wanted.
- Example lines plus a running total down the top list only: dropped in favour of per-kind cumulative sizes.
- Passing precomputed gaps into measureCoverage as an optional argument: a caller could pass gaps that don't match the recipes. measureCoverage returns the gaps it found instead.

## Watch out
- A full coverage run takes ~53 s, almost all of it walking the catalog, so findGaps must run once per command.
- A line can carry more than one gap, so the numbers are gap-line hits for that kind, not distinct lines.
- Percentages are floored to one decimal so 100% shows only once every gap is in.

In the code: packages/ingest/src/vocab-cli.ts coverage() and PAYOFF_SIZES; fillPayoff, gapsIn and measureCoverage (returns { coverage, gaps }) in packages/ingest/src/gaps.ts; tested in packages/ingest/test/vocab.test.ts.
