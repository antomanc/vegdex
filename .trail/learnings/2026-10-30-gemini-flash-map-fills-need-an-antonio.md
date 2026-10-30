---
title: Gemini Flash map fills need an explicit go-ahead for new concepts and a hand review of not-ingredient answers
author: Antonio
date: 2026-10-30
branch: fill/unknown-tail-gemini
cost: { minutes: 1, tokens: 1757 }
id: l-e6ad3c7e
scope: repo
status: active
src: agent
touches:
  - packages/ingest/data/vocab/concepts.json
  - packages/ingest/data/vocab/en.json
  - packages/ingest/src/vocab-check.ts
---

## Decided
- The user chose Gemini 3.8 Flash (medium) delegates for English `map` fills and asked to fill the whole tail, not just a top-N. The tail is flat: 10,107 phrases over 12,989 unknown lines, and about 8k of those phrases appear on a single line each.
- Batches of 250, one delegate per file, about 10 running at once.

## Tried and ruled out
- A brief saying "use only concept IDs from the candidates" plus "omit when unsure": Flash read that as "never answer new" and left about 40% of each batch out, skipping clear products like tajin, tipo 00 flour and tamarind chutney. The brief now tells it to answer new freely when no candidate fits.

## Watch out
- Flash marks labelled lines ("spices: 1 tsp cumin", "serving suggestions: rice"), sub-recipes ("super simple vegan gravy") and "from above" leftovers as not-ingredient. That hides real ingredients in every language, and apply does not catch it. Review every not-ingredient answer before applying.
- One apply run can add an alias that equals another concept's gloss ("vegan chicken-style broth"), which fails the vocab test with "gloss is already". Point the alias at the concept that owns the gloss. Don't delete the concept: it may already have an Italian name.

In the code: packages/ingest/data/vocab/{concepts,en}.json; `pnpm gaps --kind map --lang en --size 250 --batches 60`; check in packages/ingest/src/vocab-check.ts (gloss is already).
