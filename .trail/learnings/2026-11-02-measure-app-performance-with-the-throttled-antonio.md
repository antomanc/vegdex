---
title: "Measure app performance with the throttled-phone script on real data, never on the e2e fixtures"
author: Antonio
date: 2026-11-02
branch: perf/catalog-load
cost: { minutes: 73, tokens: 366879 }
id: l-b7eb49b2
scope: repo
status: active
src: agent
touches:
  - AGENTS.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/RecipeCard.svelte
  - docs/adr/0007-catalog-packed-and-searched-in-a-worker.md
  - e2e/loading.spec.ts
  - apps/web/index.html
  - apps/web/src/lib/catalog-client.ts
  - apps/web/src/lib/catalog.worker.ts
  - apps/web/src/lib/data.ts
---

## Decided
Performance work is judged by `pnpm perf`: a Pixel 7 profile with a 4x slower CPU on fast 4G, gzipped like GitHub Pages, reporting the first card, catalog ready, the slowest keystroke and filter tap (Event Timing), and heap. It needs a build over real data (`pnpm ingest emit`, then `pnpm build`). The 6-recipe fixtures hide every cost. Any change to search goes through an old-vs-new comparison on the real catalog: the 616-query check found zero result differences, and only tie order changed within newest/fastest.

## Tried and ruled out
- Indexes on the page thread alone: keystrokes got fast, but parsing 9 MB and warming the index still froze the page for about a second while the first page was on screen. That is why the catalog moved into a worker.
- Shipping tokens precomputed (176 KB gz) to save about 50 ms that now runs in the worker.
- Loading the recipe and shopping sheets on demand: only 4 KB gz saved, and the sheet became asynchronous.

## Watch out
- In e2e, every request to /data/ is answered by the fixture route in e2e/fixtures.ts. A test that intercepts a data file to delay it must call `route.fallback()`, not `route.continue()`. `continue` skips the fixture handler and serves the real 16k-recipe catalog from the local build.
- Search indexes are cached per recipes array and per display-title function. Pass a new array when recipes change and a new function when titles change. The web makes one title function per overlay for this reason.
- The open recipe must stay derivable synchronously from rows the page already has. When it went null for one tick (an async fetch from the worker), "Pick for me → Another" unmounted the sheet and left a modal that blocked the page.

In the code: scripts/perf.mjs, packages/core/src/query.ts (prepare, wordsOf, prepareSearch), apps/web/src/lib/catalog.worker.ts, e2e/loading.spec.ts.
