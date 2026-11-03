---
title: "Recipe sheet share and servings scaling: link carries only the recipe id, scaling reuses the shopping-list math"
author: Antonio
date: 2026-11-03
branch: feat/share-and-scale
cost: { minutes: 7, tokens: 16146 }
id: l-846fa2b4
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - packages/core/src/grocery.ts
  - apps/web/src/lib/state.svelte.ts
---

## Decided
- Share (#64) is an icon-only button in the sheet footer: the footer already holds Save, Another and "Cook it on <blog>" and a labelled button does not fit at 320px in Italian. The accessible name carries the label.
- navigator.share gets only { title, url }: a `text` field gets pasted next to the url by some targets (WhatsApp) and duplicates.
- Copy confirmation never changes the button's box: the share icon crossfades to a check in place, a "Link copied" bubble floats above (absolutely positioned), and an aria-live region announces it. Reduced motion swaps instantly. If copying fails, a read-only link field appears above the footer, inside the scroll area.
- The shared link is the page's language path plus ?r=<id> only; the servings scale is never in the URL (it is per sheet visit), so a shared link opens at the blog's yield.
- Scaling servings (#66) on the sheet uses the same core scaling and rounding as the shopping list, from one function in packages/core, so the two screens always agree.
- When the page language is the recipe's source language, a scaled line swaps only the amount and keeps the blog's wording; at 1x the existing rendering path is untouched.
- Stepper wording and steps match the shopping list: whole servings with a yield, half batches without.

## Watch out
- The footer is at capacity on phones; any new footer control must be checked at 320px and 360px in en and it with a long blog name.

In the code: apps/web/src/lib/RecipeSheet.svelte (footer, ingredient rendering), apps/web/src/lib/GrocerySheet.svelte (steps/perBatch, aria-live), packages/core/src/grocery.ts (compileGroceryList multiplier), apps/web/src/lib/state.svelte.ts (r param).
