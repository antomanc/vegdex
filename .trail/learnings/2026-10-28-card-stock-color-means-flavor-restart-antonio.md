---
title: Card stock color means flavor; restart vite after re-emitting data
author: Antonio
date: 2026-10-28
branch: card-file-identity
cost: { minutes: 9, tokens: 90989 }
id: l-2838e7c2
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/PRODUCT.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/Icon.svelte
  - apps/web/src/lib/RecipeCard.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/state.svelte.ts
  - apps/web/vite.config.ts
---

## Decided
- apps/web colors recipes by flavor only: rose card stock (`.sweet` swaps --surface/--line in app.css) for sweet, white for savory, on a sage-grey page (--paper #eef0e9). Per-meal colors were considered and dropped: ten hues turn the grid into a rainbow that fights the photos; flavor is two values, every recipe has exactly one, and the Savory/Sweet tabs act as the legend.
- Making flavor visible exposed tagger errors (taco crumbles, pot pies shown as sweet), fixed in packages/core/src/tags.ts. Expect colored stock to surface future tagging mistakes the same way.

## Watch out
- After `pnpm ingest emit` rewrites apps/web/public/data, a running `pnpm dev` serves the detail shards as index.html (Vite's public-file list goes stale): the sheet shows "Ingredients are unavailable offline". Restart the dev server; it is not an app bug.
