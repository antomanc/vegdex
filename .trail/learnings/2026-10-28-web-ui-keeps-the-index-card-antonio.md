---
title: "Web UI keeps the index-card world and makes it visible, rather than replacing it"
author: Antonio
date: 2026-10-28
branch: card-file-identity
cost: { minutes: 11, tokens: 173954 }
id: l-8a7cbaf1
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/app.css
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/src/lib/labels.ts
---

## Decided
- When the web UI felt like a "generic recipe site", the user chose to amplify the existing index-card identity (apps/web/DESIGN.md) instead of running a new visual-direction round. Layout, flows and palette stay; the card file shows on screen: divider tabs for Savory/Sweet + meals (FilterBar.svelte), grid cards as card stock with a mounted photo (app.css `.card`), the recipe sheet as a recipe card ("From the kitchen of <blog>", red line, printed fields, ruled ingredients).
- Tomato rule is now "one red line per card" (header, open recipe, shopping list), never on grid cards.
- Divider tabs stay toggles with aria-pressed (several meals can be on), not an ARIA tablist.

## Tried and ruled out
- Replacing the visual world: offered, not chosen; the index card already fits the product.
- Ingredient amounts in their own grid column: split the unit from its number ("1 | Tbsp olive oil") and scraped values like "10.053" blew the column wide. Amounts are bold inline instead (`splitAmount` in labels.ts).

## Watch out
- Svelte trims whitespace at the end of an `{#if}` block: write `{' '}` explicitly or ingredient text runs together ("1Tbsp").
