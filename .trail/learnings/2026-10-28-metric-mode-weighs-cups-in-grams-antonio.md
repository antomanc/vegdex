---
title: "Metric mode weighs cups in grams through a density table checked against blogs' own grams"
author: Antonio
date: 2026-10-28
branch: metric-grams
cost: { minutes: 20, tokens: 239735 }
id: l-903e6c0b
scope: repo
status: active
replaces: l-f262c412
src: agent
touches:
  - README.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/UnitsToggle.svelte
  - apps/web/src/lib/labels.ts
  - apps/web/src/lib/state.svelte.ts
  - e2e/units.spec.ts
  - packages/core/src/grocery.ts
---

## Decided
- Metric means grams for weighing (the user ruled out cups-to-ml). packages/core/src/weights.ts maps the canonical name to grams per US cup (USDA SR Legacy, King Arthur for baking), first regex match wins, family patterns last. metric.ts converts; tsp/tbsp and whole items stay as written; a blog's own grams win; ml only when the table fails.
- Rounding: under 10 to 1, under 250 to 5 (keeps "≈ 125 g" for a cup of flour; nearest 10 gave 130), under 500 to 10, then 25.
- The catalog is gitignored, so tests run on packages/core/test/fixtures/volume-lines.json from `pnpm ingest weights`. weights.test.ts needs ≥98% coverage and every table entry within 25% of the blogs' median grams.

## Watch out
- Herbs and greens are bimodal (loose leaves ~15 g/cup, finely chopped ~60). USDA values were off by 2-3x against blogs, so parsley/kale/basil/mint/dill use the blog median.
- Family patterns misfire on substrings: "coconut" ends in "nut", "butternut" starts with "butter", "sugar snap peas" contains "sugar". Anchor with \b.
- Blog ml can be typos ("¼ cup (5 ml)"); metric.ts ignores blog ml more than 50% off its cups. Blog grams can't be checked that way.
- In the recipe sheet on desktop, the sticky close button covers the ingredients column's top right; .ingredients-head has padding-right for it.
- agent-browser against `vite preview` serves the PWA service worker's cached old build after a rebuild: unregister it and clear caches first.
