---
title: "Unknown ingredient names are resolved by general parser rules before any fill, each guarded against animal words"
author: Antonio
date: 2026-10-29
branch: docs/vocabulary-rules
cost: { minutes: 131, tokens: 1034744 }
id: l-d119e017
scope: repo
status: active
src: agent
touches:
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/recipes.full.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
  - e2e/fixtures/italian-data/lookup/it.json
  - e2e/fixtures/italian-data/recipes.full.json
  - packages/core/src/concepts.ts
  - packages/core/src/index.ts
---

## Decided
- The user chose rules over more model fills for the tail. Order: name as written, then without a plant qualifier, then one typo fixed, then terms or a product brand peeled off; every step that drops words refuses to land on an animal word ("Violife cheddar", "parmegan").
- "A or B C": the shared noun ("lemon or lime juice") is tried before A alone; only-B-known means B stands in. This replaced the blanket "romano or ramiro pepper" guard.
- Non-ingredient lines (equipment, instructions, fill "not-ingredient" phrases) are hidden in every language; headings only outside their own language.

## Tried and ruled out
- Splitting on unspaced slashes ("flour/starch"): coverage dropped from 92.5% to 92.4%.
- Letter substitutions as typos: they turn foods into others ("rice malt" vs "rice salt"); only missing, extra or swapped letters count.

## Watch out
- Peeling descriptor words is safe only because the full phrase is looked up first ("sweet potato", "green beans" stay concepts); add a term only for words that keep the product's identity.
- After rules, the remaining ~6% is genuinely new products; measure with pnpm coverage before writing another rule.

In the code: packages/core/src/ingredients.ts (resolveName, peelTerms, splitIngredients, lineKind), packages/core/src/spelling.ts, vocab/en.json "brands".
