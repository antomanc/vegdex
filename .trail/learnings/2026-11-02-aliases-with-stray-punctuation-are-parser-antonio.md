---
title: "Aliases with stray punctuation are parser gaps: fix the parser, never just delete them"
author: Antonio
date: 2026-11-02
branch: parse/split-lines
cost: { minutes: 9, tokens: 64801 }
id: l-4b67b9e1
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/labels.ts
  - e2e/fixtures/data/details/02.json
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/recipes.full.json
  - e2e/fixtures/italian-data/details/02.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
---

## Decided
English aliases like ". garlic powder", "” ginger", "baking powder." or "salt" followed by an invisible separator were learned from an older parser's leftovers. The fix lives in line normalization. Each alias is then kept in its cleaned form where that phrase is free, and the vocabulary check rejects new ones ('stray-punctuation').

## Tried and ruled out
Deleting the 50 aliases alone made 58 catalog lines lose their exact match. They were the only thing reading "1 c . flour", "1/2” ginger" and "salt" followed by an invisible character. Two cleaned aliases were wrong and were dropped: "cup parsley" is a unit fragment, and "ground coriander" clashed with an existing concept, which the vocabulary test caught.

## Watch out
Convert inch marks only in the leading amount. Doing it mid-line put "inch" into names like "1” diced pumpkin". Italian "q.b." is a real abbreviation, so the trailing-period rule only applies after a word of 3+ letters. Leading "- inch …" aliases are deliberate legacy shapes for the as-written lookup.

In the code: packages/core/src/ingredients.ts normalizeLine; packages/ingest/src/vocab-check.ts STRAY. To verify a vocabulary edit, parse every catalog line with the HEAD vocabulary and the working-tree vocabulary using the same parser; `pnpm parse:diff` covers parser changes only.
