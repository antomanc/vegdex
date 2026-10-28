---
title: "Metric mode means grams for weighing, not cups-to-ml"
author: Antonio
date: 2026-10-28
branch: main
cost: { minutes: 5, tokens: 25450 }
id: l-f262c412
scope: repo
status: active
src: agent
touches:
  - packages/core/src/ingredients.ts
---

## Decided
- Metric ingredient amounts are for weighing on a scale. Converting cups to ml is useless for that; the user ruled it out. Cups must become grams through a density per ingredient (planned table next to the parser in packages/core/src/ingredients.ts).
- tsp/tbsp stay unconverted in metric mode. A grams figure the blog wrote itself (extractMetric, e.g. "(15 oz / 425 g)") beats our own conversion.
- Convert in the browser at display time (RecipeSheet.svelte, GrocerySheet.svelte). The dataset and MCP output keep the raw lines.

## Watch out
- Measured on the catalog: 39,696 US-volume lines, only 2,410 already in grams, 2,994 distinct names; a table of the top 200 names covers about 80% of the rest. Common ones: water, broth, flour, sugar, vegan butter, plant milk, cashews.
