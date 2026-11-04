---
title: Lock the page beneath sheets and restore source navigation after history settles
author: Antonio
date: 2026-11-04
branch: main
id: l-28e6268c
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/sheet.ts
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/overlay/en.json
  - e2e/fixtures/data/recipes.full.json
  - e2e/fixtures/italian-data/dictionary.json
---

## Decided
Modal sheets fix the body at its saved offset until the last sheet is destroyed, then restore its styles and scroll position. The root and dialog suppress overscroll while open; only the dialog scrolls. Tests check the underlying card rectangle, since a fixed body's window.scrollY becomes zero even though the visible grid stays in place.
## Tried and ruled out
Native showModal alone left the background scrollable: a wheel on the scrim moved the underlying card by 221px in the fixture repro. Waiting for a Svelte tick before scrolling a newly selected source shelf to the top was insufficient: history.back subsequently restored the old grid offset (221px mobile, 206px desktop). Scheduling that intentional scroll from the sheet's popstate callback in the next animation frame preserved the source navigation.
## Watch out
Keep the page locked during exit animation and release it on component destruction, including direct navigation to a source shelf. Ordinary close and Back restore the old grid position; changing to a source shelf deliberately starts at the top. Exercise wheel and touch drags at both edges, normal ingredient scrolling, restoration, and source navigation.
In the code: apps/web/src/lib/sheet.ts; apps/web/src/App.svelte onSheetPop/showKitchen; apps/web/src/app.css; e2e/sheet-scroll.spec.ts. Repro: pnpm exec playwright test e2e/sheet-scroll.spec.ts --workers=2.
