---
title: "Shopping-list row names: majority of alias-matched spellings surfaces typo aliases; vocabulary names are worse"
author: Antonio
date: 2026-11-03
branch: design/critique-fixes
cost: { minutes: 14, tokens: 156646 }
id: l-abfc651a
scope: repo
status: active
src: agent
touches:
  - apps/web/src/App.svelte
  - e2e/browse.spec.ts
  - apps/web/src/app.css
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/DESIGN.md
  - apps/web/messages/en.json
  - apps/web/messages/it.json
  - apps/web/src/lib/state.svelte.ts
  - apps/web/src/lib/RecipeSheet.svelte
  - packages/core/src/grocery.ts
---

## Decided
Left the shopping-list naming alone during the Nov 3 design pass; it needs its own fix in the pipeline.

## Tried and ruled out
Naming every grocery row by the concept's shortest English vocabulary name (what emit already does for non-English lines). Compared against the published rows, 745 of 1787 names would change and many get worse: "coconut oil" -> "copra", "black pepper" -> "hot pepper", "turmeric" -> "curcuma", "salt" -> "kosher salt".

## Watch out
groceryConcepts names a row by the majority among written names that the lookup maps to that exact concept. When almost no written names qualify, a typo alias wins: the garlic-clove concept is written "garlic" 2287 times (which maps to the garlic concept, so it doesn't count) and "gloves garlic" twice, so the row reads "Gloves garlic". About 486 rows are named from under 20% of their lines; others lose accents ("b nh m sauce", "aj panca paste").

In the code: packages/core/src/grocery.ts groceryConcepts; packages/ingest/src/emit.ts builds `grocery` for lookup/en.json.
