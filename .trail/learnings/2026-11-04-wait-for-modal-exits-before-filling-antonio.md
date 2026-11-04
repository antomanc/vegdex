---
title: Wait for modal exits before filling controls behind them
author: Antonio
date: 2026-11-04
branch: main
id: l-a4a08fe6
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/app.css
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/sheet.ts
  - e2e/concepts.spec.ts
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
---

## Decided
Sheets stay modal during their brief exit animation, preserving focus and the backdrop until close. Browser tests must await the dialog becoming hidden before filling the page search field.
## Tried and ruled out
Filling search immediately after clicking Close left the previous results visible: Playwright fill could change a field behind the still-modal dialog without delivering the normal input update. This looked like a search regression; waiting for the modal to close resolved all eleven affected cases without changing their result assertions.
## Watch out
Keep repeated dismissal idempotent and cancel pending exit animations when a component is destroyed. Reduced motion closes immediately and preserves color/state feedback.
In the code: apps/web/src/lib/sheet.ts; e2e/motion.spec.ts; pnpm exec playwright test --last-failed --workers=2.
