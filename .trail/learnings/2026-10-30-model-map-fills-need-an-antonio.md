---
title: Model map fills need an explicit go-ahead for new concepts and a hand review of not-ingredient answers
author: Antonio
date: 2026-10-30
branch: fill/unknown-tail-gemini
cost: { minutes: 2, tokens: 17001 }
id: l-ce91be43
scope: repo
status: active
replaces: l-e6ad3c7e
src: agent
touches:
  - packages/ingest/data/vocab/concepts.json
  - packages/ingest/data/vocab/en.json
  - packages/ingest/src/vocab-check.ts
---

## Decided
- English `map` fills cover the whole tail, not just a top-N. The tail is flat: 10,107 phrases over 12,989 unknown lines, and about 8k of those phrases appear on a single line each.
- Batches of 250, one worker per file, about 10 running at once.

## Tried and ruled out
- A brief saying "use only concept IDs from the candidates" plus "omit when unsure": a fast model read that as "never answer new" and left about 40% of each batch out, skipping clear products like tajin, tipo 00 flour and tamarind chutney. The brief now tells it to answer new freely when no candidate fits.

## Watch out
- Models mark labelled lines ("spices: 1 tsp cumin"), sub-recipes ("super simple vegan gravy") and amount fragments as not-ingredient. A fragment like "16 oz" or "/can" comes from "1 16 oz block tofu" or "1 jar/can artichoke hearts", so hiding it hides a real ingredient in every language, and apply does not catch it. Review every not-ingredient answer against its example line before applying.
- Many gaps are amount leftovers the parser didn't strip ("15g fresh lime juice", "/ 1 + 1/3 cup plant milk", "1 16 oz"). Apply rejects their answers as not-whole, so they cost model tokens for nothing. A parser rule for unspaced units, slash dual measures and "+" amounts would clear them more cheaply than a fill.
- One apply run can add an alias that equals another concept's gloss ("vegan chicken-style broth"), which fails the vocab test with "gloss is already". Point the alias at the concept that owns the gloss. Don't delete the concept: it may already have an Italian name.

In the code: packages/ingest/data/vocab/{concepts,en}.json; `pnpm gaps --kind map --lang en --size 250 --batches 60`; checks in packages/ingest/src/vocab-check.ts ("gloss is already", not-whole).
