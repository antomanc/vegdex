---
title: Keep native edge feedback inside scroll-locked sheets
author: Antonio
date: 2026-11-04
branch: main
id: l-ca9b31e3
scope: repo
status: active
replaces: l-28e6268c
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/sheet.ts
---

## Decided
Modal sheets fix the body at its saved offset until the last sheet is destroyed, then restore its styles and scroll position. Keep overscroll-behavior:none on the locked root, but use contain on the dialog: block chaining and page refresh while preserving native elastic edge feedback. Antonio clarified that the hard stop at the top and bottom felt unpleasant; ordinary momentum in the middle was fine.
## Tried and ruled out
Native showModal alone left the background scrollable: a wheel on the scrim moved the underlying card by 221px. Setting none on the dialog fixed containment but removed the native edge feedback, which the user rejected after trying it. Waiting for a Svelte tick before scrolling a newly selected source shelf to the top also failed: history.back subsequently restored the old grid offset (221px mobile, 206px desktop). Scheduling that intentional scroll in the next frame from the sheet popstate callback fixed source navigation.
## Watch out
Keep the page locked during exit animation and release it on component destruction, including direct source navigation. Ordinary close and Back restore the old grid position; a source shelf starts at the top. Check underlying card rectangles (window.scrollY becomes zero while the body is fixed), wheel and touch drags at both edges, normal ingredient scrolling and history restoration. Let the OS supply edge feedback; do not fake scrolling with animation or cancel normal touchmove gestures.
In the code: apps/web/src/lib/sheet.ts; apps/web/src/App.svelte onSheetPop/showKitchen; apps/web/src/app.css; e2e/sheet-scroll.spec.ts. Repro: pnpm exec playwright test e2e/sheet-scroll.spec.ts --workers=2.
