---
title: "Infinite scroll stops at 192 recipes so the credits footer is reachable; Svelte drops a span's leading space"
author: Antonio
date: 2026-10-27
branch: main
cost: { minutes: 5, tokens: 35123 }
id: l-cc5fe4ab
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - e2e/browse.spec.ts
---

## Decided
apps/web/src/App.svelte auto-loads only up to AUTO_LIMIT (4 pages of 48), then shows "Show more recipes". With 13k recipes, endless scroll meant the credits footer was never seen, and creator credit is a product commitment (PRODUCT.md). The result count also credits sources ("N recipes from M vegan blogs"), counted over the current results.
The CSS uses only the type, radius and shadow values in apps/web/DESIGN.md; add a new step there before using it, or the impeccable detector flags drift.

## Watch out
Svelte trims a leading space at the start of an element's content: `<span> from…</span>` rendered "6 recipesfrom". Use `{' '}` inside the span. The e2e "count credits the blogs" test catches it.
Parser changes in packages/core reach the live search index (`ing` in catalog.json) only when the dataset is re-emitted; the daily workflow does that on every push to main touching packages/core. `pnpm fixtures` after a parser change can come back identical apart from generatedAt; don't commit that churn.
