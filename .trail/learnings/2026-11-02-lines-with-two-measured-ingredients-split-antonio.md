---
title: Lines with two measured ingredients split into parts only when every part is known and named on its own
author: Antonio
date: 2026-11-02
branch: parse/split-lines
cost: { minutes: 20, tokens: 249289 }
id: l-36744e3c
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/data.ts
  - docs/agents/vocabulary.md
  - e2e/browse.spec.ts
  - e2e/fixtures/data/catalog.json
  - e2e/fixtures/data/coverage.json
  - e2e/fixtures/data/details/02.json
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
---

## Decided
A raw line like "2 tsp cornstarch + 2 tbsp water" becomes several parsed parts (ADR 0006), not an `also` with an amount and not rewritten raw lines. One raw line still maps to one shipped entry, either an object or an array of parts, so positions stay aligned and older datasets load. Splitting happens in core so ingest, the web grocery fallback and tests share it. In the recipe's own language the line shows as written; parts only show in another language and on the shopping list.

## Tried and ruled out
Reviewing every split with `pnpm parse:diff HEAD` showed these splits read wrong, and they are now rejected:
- "zest of 1 lemon + 2 tbsp juice", "+ 1 tbsp sauce/brine", "+ ¼ cup pulp": the later part only names what it takes from the first, so it mapped to a generic concept (juice, sauce).
- "1 head of garlic + 3 large cloves": the later part had only a unit word, which mapped to the clove spice.
- "1 tsp each cumin, turmeric, coriander and ½ tsp chilli": the first part kept cumin and dropped the rest of the list as a note.
- "X or 1 tsp Y + 2 tbsp water": the "+" binds to the alternative.

## Watch out
Most of the ~870 two-amount lines do not split yet, because one part is still an unknown phrase. Map fills raise that count without any parser change. Expect a few same-concept splits ("1/2 cup water + 1/2 cup water"). They render as two lines and merge on the shopping list, which is acceptable.

In the code: packages/core/src/ingredients.ts parseLine, PART_JOINERS, BACK_REFERENCE, SHARED_AMOUNT, lineParts; packages/ingest/src/parse-diff.ts.
