---
title: "Measure ingredient names with parseIngredient().name, not canonicalName on whole lines"
author: Antonio
date: 2026-10-28
branch: multi-language-plan
cost: { minutes: 2, tokens: 21560 }
id: l-f79bcaa2
scope: repo
status: active
replaces: l-d4fc1595
src: agent
touches:
  - GLOSSARY.md
  - apps/web/PRODUCT.md
  - docs/adr/0002-ui-languages-under-path-prefixes.md
  - docs/adr/0003-recipes-translated-through-concepts.md
  - docs/adr/0004-llm-work-runs-as-a-manual-catch-up.md
  - packages/core/src/ingredients.ts
---

## Decided
- Ingredient lines are translated through concepts seeded from the Open Food Facts ingredient taxonomy (docs/adr/0003). Exact taxonomy matches cover 72% of catalog lines; vegan-qualified ingredients get their own seed entries.

## Tried and ruled out
- Counting names with canonicalName (packages/core/src/ingredients.ts) on raw lines: it keeps units ("teaspoon salt") and gave an inflated 17,255. parseIngredient(line).name gives 10,429 distinct names over 168k lines; 318 cover 80% and 1,006 cover 90%.

## Watch out
- Never match a vegan-qualified name loosely: "vegan butter" stripped to "butter" hits the taxonomy entry flagged vegan: no and renders as "burro". Every rendered line and title still passes the per-language animal-word check.
