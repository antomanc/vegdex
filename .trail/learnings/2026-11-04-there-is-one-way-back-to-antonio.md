---
title: "There is one way back to the top, docked beside Pick for me"
author: Antonio
date: 2026-11-04
branch: main
cost: { minutes: 7, tokens: 82036 }
id: l-0db6c6c7
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - e2e/market-navigation.spec.ts
---

## Decided
The browse screen has a single return control, sitting in the bottom dock beside "Pick for me" at the same 52px pill height. While browsing it reads "Filters" (with the active count in an ink badge) and shows once the filters scroll away. In Saved it reads "Back to top" and shows after 600px. Either way it scrolls to the top and focuses the brand.

## Tried and ruled out
Separate floating "Back to top" and "Filters" buttons in opposite corners, above the dock: both did the same thing, and on phones they sat out of line with Pick. The user rejected them.

## Watch out
`pnpm test:e2e` rewrites the fixture data under e2e/fixtures/. Don't stage it with `git add -A`: it isn't part of a UI change, and trail check flags it against parser learnings.

In the code: apps/web/src/App.svelte (showReturn, showPick, backUp, .dock markup); apps/web/src/app.css (.dock, .dock-return, .dock-count); e2e/market-navigation.spec.ts (docked Filters test).
