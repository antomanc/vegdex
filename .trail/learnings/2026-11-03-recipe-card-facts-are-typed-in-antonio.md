---
title: "Recipe card facts are typed in Courier Prime, but copy and controls stay in the sans"
author: Antonio
date: 2026-11-03
branch: fix/launch-quick-wins
cost: { minutes: 11, tokens: 154399 }
id: l-7f6be18e
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/package.json
  - apps/web/src/app.css
  - apps/web/src/main.ts
  - pnpm-lock.yaml
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - docs/research/pre-promotion-plan.md
---

## Decided
To make the index-card world more distinctive (the user asked for an elevated, non-generic look and chose to push the index card rather than replace it), values a cook would type onto a card are set in Courier Prime: the photo's time label, the open card's field values, ingredient and shopping amounts, the kitchen's name and the results count.

## Tried and ruled out
Courier Prime for the discovery hint sentence and in 700 at 1-1.05rem for the field values: it runs so wide that "6 g protein" wrapped to three lines at 390px and the hint took two lines above the filters. Sentences stay in the system sans; the typed values use 400 at 0.94rem or below.

## Watch out
The font cost nothing measurable in `pnpm perf` (first card 917 ms vs the 0.93 s baseline), because only the 400 and 700 weights load, split by unicode range.

In the code: apps/web/src/app.css (--typed), apps/web/src/main.ts (@fontsource/courier-prime 400/700), apps/web/DESIGN.md "The Typewriter Fills In Facts Rule".
