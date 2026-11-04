---
title: "The docked return button always says Back to top, never Filters"
author: Antonio
date: 2026-11-04
branch: fix/dock-back-to-top
cost: { minutes: 4, tokens: 12768 }
id: l-6dc27fac
scope: repo
status: active
replaces: l-0db6c6c7
src: agent
touches:
  - e2e/concepts.spec.ts
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - e2e/market-navigation.spec.ts
---

## Decided
The browse screen has one return control, sitting in the bottom dock beside "Pick for me" at the same 52px pill height. It always reads "Back to top" with an up arrow. It shows once the filters scroll out of view (in Saved, after 600px), scrolls to the top and focuses the brand.

## Tried and ruled out
Labelling it "Filters" with an active-filter count: the user rejected it because it doesn't say the tap scrolls all the way up, so people would lose their place in the list expecting a filter panel. Separate floating "Back to top" and "Filters" buttons in opposite corners: both did the same thing and sat out of line with Pick on phones.

## Watch out
`pnpm test:e2e` rewrites the fixture data under e2e/fixtures/. Restore it (`git checkout -- e2e/fixtures`) and don't stage it with `git add -A`. The mobile test "Italian have and avoid keep all-includes…" in e2e/concepts.spec.ts fails sometimes under the full suite but passes on its own.

In the code: apps/web/src/App.svelte (showReturn, showPick, backUp, .dock markup); apps/web/src/app.css (.dock, .dock-return); e2e/market-navigation.spec.ts.
