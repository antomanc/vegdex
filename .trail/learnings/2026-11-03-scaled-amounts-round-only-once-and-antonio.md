---
title: "Scaled amounts round only once, and lines vegdex cannot compose say they are not scaled"
author: Antonio
date: 2026-11-03
branch: feat/share-and-scale
cost: { minutes: 10, tokens: 132645 }
id: l-e5b905ff
scope: repo
status: active
src: agent
touches:
  - apps/web/messages/en.json
  - apps/web/messages/it.json
  - apps/web/src/app.css
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/Icon.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/labels.ts
  - e2e/scale-servings.spec.ts
  - e2e/share.spec.ts
  - packages/core/src/grocery.ts
---

## Decided
- A scaled line shown in its own unit snaps to the kitchen grid (⅛ ¼ ⅓ ½ ⅔ ¾; grams and ml to round numbers). A line converted to metric is scaled exactly and rounded only by the metric formatter: snapping cups first lost precision (⅓ cup flour (40 g) × 1.25 gave 40 g instead of 50 g).
- While scaled, a measured line that cannot be composed keeps the blog's amount and is marked "(not scaled)", so a cook never mixes scaled and unscaled amounts without knowing.

## Watch out
- The share button sits at the footer's right edge: a centred "Link copied" bubble was clipped at 320px, so it is anchored to the button's right side.

In the code: scaleIngredient in packages/core/src/grocery.ts; ingredientRows and the .share/.bubble rules in apps/web (RecipeSheet.svelte, app.css).
