---
title: Web UI keeps the vegan guarantee implicit; .small class collides between buttons and paragraphs
author: Antonio
date: 2026-10-27
branch: main
cost: { minutes: 11, tokens: 99955 }
id: l-f6ba9f4e
scope: repo
status: active
src: agent
touches:
  - apps/web/PRODUCT.md
  - apps/web/src/app.css
---

## Decided
- The vegan guarantee stays implicit in the web UI (apps/web): no headline claim, no per-recipe "verified vegan" badges. The name and the all-vegan sources carry it. Recorded in apps/web/PRODUCT.md under Brand Commitments.
- UI fix priority after the first impeccable critique (20/40, .impeccable/critique/): filter visibility + Saved view first, then the mobile More-filters layout, the shopping list, then a polish pass.

## Tried and ruled out
- Showing the guarantee "quietly" (a line under the brand plus a checked mark in the sheet) or "front and center" (a headline with an explainer): the user chose neither.

## Watch out
- `.small` in apps/web/src/app.css:80 is a button style (green background), but `p.muted.small` in RecipeSheet.svelte and GrocerySheet.svelte picks it up too, which makes the creator-credit footnote unreadable (2.1:1 contrast). Rename the button class rather than piling on overrides.
- Saved mode adds the saved ids to the active filters (state.svelte.ts toQuery), so with any filter on, Saved can show "0 saved" while the header says "Saved · 3".
