---
title: "A can with a stated weight stays a can beside its weight, never bare grams"
author: Antonio
date: 2026-11-06
branch: fix/amounts
id: l-438f028b
scope: repo
status: active
src: agent
touches:
  - docs/review/italian-lines.md
  - packages/core/src/ingredient-display.ts
  - packages/core/src/metric.ts
  - packages/core/test/golden/ingredient-lines.json
  - packages/core/test/ingredient-display.test.ts
  - packages/core/test/ingredients.test.ts
  - packages/ingest/src/parse-diff.ts
---

## Decided
A package line shows its container and weight together: "1 can (400 g) chickpeas", "1 lattina (400 g) di ceci". The container says what to buy, the weight says how much.

## Tried and ruled out
Rendering the package as bare grams ("400 g chickpeas"). It passed the audit score, tests and the golden gate, but drops the word that matters: 400 g of dried chickpeas is far more food than one can, and "canned" was already the most often lost qualifier.

## Watch out
The audit score flagged this as a lost qualifier and it was first dismissed as wording noise. Read newly flagged lines before calling them false positives. parse:diff also ignored metric values until this change, so older "0 changed" results did not cover them; the parser split was rechecked by comparing full parse objects on every distinct line.

In the code: packages/core/src/metric.ts, packages/core/src/ingredient-display.ts, packages/ingest/src/parse-diff.ts.
