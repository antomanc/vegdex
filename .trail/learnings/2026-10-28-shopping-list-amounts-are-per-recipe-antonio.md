---
title: "Shopping list amounts are per recipe, stored as multipliers and snapped to each recipe's steps"
author: Antonio
date: 2026-10-28
branch: grocery-servings
cost: { minutes: 1, tokens: 1648 }
id: l-0ab93221
scope: repo
status: active
src: agent
touches:
  - apps/web/src/lib/GrocerySheet.svelte
---

## Decided
- Per-recipe steppers in apps/web/src/lib/GrocerySheet.svelte replaced the global "Scale all" pills: the user ruled out keeping both, because two controls that multiply each other confuse.
- The user chose a stepper with no 0, no reset and no typed input: "skip this week" would make a third kind of saved recipe, and a typed input pops the phone keyboard.
- Storage is `vegdex:grocery-amounts`, id -> multiplier (not servings), so a re-crawl that changes a yield doesn't silently change the list. Values are snapped to the step grid on read (`steps()`) for the same reason.
- An amount is forgotten once the unsave is final: on leaving the saved view (App.svelte effect), or immediately when unsaving anywhere else (toggleSaved in state.svelte.ts), because only the saved view offers an undo.
- Stepper buttons use aria-disabled, not disabled, so keyboard focus survives hitting a bound.

## Watch out
- e2e locators like `list.locator('li', { hasText: 'red lentil' })` also match the recipe rows ("Red Lentil Soup") in the amounts list: scope them to `getByTestId('grocery-list')`.
- The e2e fixture's lentil-soup has `servings: null` on purpose, to cover the half-batch stepper.
