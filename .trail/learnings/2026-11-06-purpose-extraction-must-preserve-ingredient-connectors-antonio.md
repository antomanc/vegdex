---
title: Purpose extraction must preserve ingredient connectors and recipe-dependent amounts
author: Antonio
date: 2026-11-06
branch: fix/name-extraction
id: l-9f0b5a10
scope: repo
status: active
src: agent
touches:
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/overlay/en.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
  - e2e/fixtures/italian-data/lookup/it.json
  - e2e/fixtures/italian-data/overlay/en.json
  - packages/core/src/ingredients/name.ts
---

## Decided
A cooking purpose may move into commentary only after the whole phrase fails lookup and the remaining product matches the vocabulary exactly. Keep suffixes with ingredient connectors, numeric amounts, or count words intact. Existing preparation terms should keep their established handling.

## Tried and ruled out
A broad trailing-purpose peel improved coverage but lost powdered sugar in a topping clause and salt after pasta water. It also hid soaking durations. A method-dependent broth amount exposed an incorrect metric conversion when newly composed; keep that shape intact instead of dismissing its audit flag.

## Watch out
Audit wording flags require reading the original and rendered lines. A suffix may contain another ingredient or the quantity needed for one recipe component. The guard for dropped fill words protects real amounts; name extraction alone cannot safely remove it.

In the code: packages/core/src/ingredients/name.ts; packages/core/test/name-extraction.test.ts. Verify with pnpm audit:score, pnpm parse:diff and pnpm golden. Audit and throwaway per-line reports remain uncommitted.
