---
title: "Amount shapes are fixed in the parser, checked by diffing every catalog line before and after"
author: Antonio
date: 2026-10-30
branch: fill/unknown-tail-gemini
cost: { minutes: 31, tokens: 309779 }
id: l-21445344
scope: repo
status: active
src: agent
touches:
  - docs/agents/vocabulary.md
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/recipes.full.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
  - e2e/fixtures/italian-data/lookup/it.json
  - e2e/fixtures/italian-data/recipes.full.json
  - packages/core/src/concepts.ts
---

## Decided
- The parser should be as complete as possible before more model fills. Gaps that start with a number, "/", "+" or a unit are parser bugs: earlier fills had learned aliases with those leftovers in them ("can crushed tomatoes", "batch of korean bbq sauce", "- inch ginger").
- The parser now also looks a name up in the shape an older parse left it ("as written"), so those aliases keep working. Without that, about 150 lines that used to resolve stopped resolving.
- An alternative with its own amount ("1 tbsp fresh thyme or 1/2 tsp dried") is dropped as commentary. Otherwise the second ingredient would be shown under the first one's amount.

## Tried and ruled out
- "stick" as a unit: "2-3 sticks cinnamon" became ground cinnamon.
- "sprinkles" as a unit: it is a food. Only the singular "sprinkle" is a unit.
- Splitting "A/B" at the slash: "chickpea/garbanzo bean flour" became chickpea. Swap one word at a time instead.
- Moving "+ more ..." into the notes: it changed how "sea salt + more to taste" renders. Term lookup reads a leading "+" as "plus" instead.

## Watch out
- Verify a parser change by parsing every catalog line with the old and the new parser and diffing them (lost, concept changed, amount changed). The gap list alone misses regressions.
- The remaining digit gaps are mostly two ingredients each with their own amount ("cornstarch + 2 tbsp water", "lemon juice + zest of 1 lemon"). ParsedIngredient.also carries no amount, so these need a model change, not a regex.

In the code: packages/core/src/ingredients.ts (parseIngredient: written/legacy/asWritten, skipAltMeasure, LABEL_RE, ALT_AMOUNT_RE), lookupTerm in packages/core/src/concepts.ts, new units in packages/ingest/data/vocab/{en,it}.json, tests in packages/core/test/ingredients.test.ts.
