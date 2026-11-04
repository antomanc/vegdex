---
title: Give the save pulse enough time at its peak to be seen
author: Antonio
date: 2026-11-04
branch: main
id: l-885b6b5f
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/app.css
  - apps/web/src/lib/RecipeCard.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/sheet.ts
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/overlay/en.json
  - e2e/fixtures/data/recipes.full.json
---

## Decided
The heart needs a visible save gesture: compress, expand, settle, plus a fading ring on grid cards. Use easing on individual keyframe phases with a linear overall timeline, so the expanded heart remains perceptible.
## Tried and ruled out
The first pass only changed the saved icon size; Antonio found it too subtle and asked for the memorable motion originally discussed. A global fast ease-out on the complete pulse also pushed the expansion peak into the first few frames, making the animation look weak despite a 140% keyframe. Per-phase easing keeps the peak near the middle of the 440ms gesture.
## Watch out
Celebrate only an explicit save, not loading stored favorites. Cancel the pulse on unsave and component destruction. Reduced motion keeps the filled heart without scaling or rings.
In the code: apps/web/src/lib/save-feedback.ts; apps/web/src/lib/RecipeCard.svelte; apps/web/src/lib/RecipeSheet.svelte; e2e/motion.spec.ts.
