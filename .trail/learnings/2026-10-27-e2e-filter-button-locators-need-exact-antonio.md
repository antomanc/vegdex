---
title: "E2E filter-button locators need exact: true because active-filter chips repeat the label"
author: Antonio
date: 2026-10-27
branch: main
cost: { minutes: 9, tokens: 110315 }
id: l-a5bc6562
scope: repo
status: active
src: agent
touches:
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/ActiveFilters.svelte
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/Icon.svelte
  - apps/web/src/lib/RecipeCard.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/labels.ts
  - e2e/saved.spec.ts
---

## Watch out
- apps/web/src/lib/ActiveFilters.svelte shows a removable chip for each active filter, with aria-label "Remove <label>" (e.g. "Remove ≤ 15 min"). Playwright's getByRole('button', { name }) does a substring match, so once a filter is on, a locator like { name: '≤ 15 min' } matches both the pill and the chip, and the test fails with a strict-mode violation. Use { exact: true } for filter pills in e2e/*.spec.ts, as browse.spec.ts now does.
- The failure only shows up on the second click of a toggle (when the chip already exists), not the first.
