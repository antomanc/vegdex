---
title: "Italian shapes and each-lists are rewritten in the parser, guarded by parse:diff against qualifier loss"
author: Antonio
date: 2026-11-03
branch: fix/translation-quality
cost: { minutes: 17, tokens: 104110 }
id: l-29c56b21
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/daily.yml"
  - README.md
  - apps/web/vite.config.ts
  - packages/ingest/data/vocab/concepts.json
  - packages/ingest/data/vocab/en.json
  - packages/ingest/data/vocab/it.json
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/it.json
---

## Decided
- Cucinaverza recipes were held mostly by parser gaps, not unknown ingredients. Italian shapes are handled in packages/core/src/ingredients.ts (italianShapes, the fill words after a unit, units in languages.ts only after an amount) and trailing notes in languages.ts (trailingNote).
- "1/4 tsp each A, B" splits into parts with the shared amount only when every item is known (sharedAmountParts); a shared-amount list that cannot split is marked conceptExact false, so it stays as written instead of showing its first item alone.
- Notes pushed by Italian rewrites are Italian words with Italian aliases ("spremuto", "solo la scorza", "quanto basta"), because the line's own language shows note text as written.

## Tried and ruled out
- "montat[oaie]" as a trailing note: "panna montata vegetale" became "panna", dropping the plant qualifier. Never add a trailing-note word that can sit between an animal word and its qualifier.
- Rewriting "succo/scorza di limone" without an amount: "Succo di limone" turned from lemon juice into lemon. The rewrite needs an explicit amount (un, mezzo, a number).
- Rewriting "farina di tipo 0" to "farina 0": only "farina tipo N" is an alias, so lines lost their concept.

## Watch out
- "each" inside brackets sizes a package ("2 cans (15 oz / 425 g each)"); before splitting, the text before "each" must be only the amount (no brackets, no "or").
- "rolls" as an English unit read "8 rolls or buns" as a unit; only singular "roll" and "leaf" are units.
- The unit regex in languages.ts runs without the u flag: use an explicit letter class ([a-zà-ù]) for word ends, not \p{L}.
- Run `pnpm parse:diff main` and read the LOST, concept and name lines after every Italian parser change.
