---
title: "Shopping list share sends text only, built from the rendered rows"
author: Antonio
date: 2026-11-03
branch: feat/share-shopping-list
cost: { minutes: 11, tokens: 72437 }
id: l-14947f17
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/GrocerySheet.svelte
---

## Decided
- The shopping list's Share/Copy button (#65) calls navigator.share with { text } only. The text already starts with the list's title, and some apps paste a share title above the text, so passing title would print it twice.
- groceryListText in apps/web/src/lib/grocery-text.ts takes strings already formatted for display (aisle label, item name, amount). GrocerySheet.svelte builds them with the same aisleLabel/itemName/itemAmount helpers its template uses, so the copied text cannot drift from what the sheet shows. The builder capitalizes the first letter itself, because the sheet does it in CSS.
- Checked items are dropped, and so is an aisle left empty. Excluded recipes are dropped from the closing recipe titles; their items are already absent from compile().
- When the clipboard refuses, a selected read-only textarea shows the text, the same fallback as the recipe sheet's link field.

## Watch out
- playwright.config.ts reuses any server already on port 4174 outside CI. With several worktrees running e2e at once, a run can hit another checkout's build and fail for no reason in this code. Run with CI=1 to make it build and serve its own.
