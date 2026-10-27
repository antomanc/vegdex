---
title: Sheets push one history entry; the URL entry below must be rewritten on pop
author: Antonio
date: 2026-10-27
branch: main
cost: { minutes: 23, tokens: 260938 }
id: l-b2ffdffe
scope: repo
status: active
src: agent
touches:
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/RecipeSheet.svelte
  - apps/web/DESIGN.md
  - apps/web/index.html
  - apps/web/package.json
  - apps/web/src/lib/ActiveFilters.svelte
  - apps/web/src/lib/FilterBar.svelte
  - apps/web/src/lib/GrocerySheet.svelte
  - apps/web/src/lib/Icon.svelte
---

## Decided
Every sheet `<dialog>` in apps/web uses the `sheet` action (apps/web/src/lib/sheet.ts): it pushes one history entry on open so Android back / iOS swipe closes the sheet instead of leaving vegdex. Closing by button, Esc or backdrop calls history.back() to drop that entry (counted in `ownBacks` so the popstate isn't treated as a user back).

## Watch out
Filter state is mirrored with replaceState (state.svelte.ts writeUrl), so changes made while a sheet is open (More filters) land on the guard entry. Popping it reveals the older URL underneath; App.svelte registers onSheetPop(() => writeUrl(...)) to rewrite it with current state. Don't call readUrl() on popstate: it would roll back filters chosen in the sheet (covered by e2e "back closes More filters and keeps what was chosen in it").
The empty state must keep a plain "Clear filters" button even when the "Remove “X”" suggestion does the same thing: e2e "an empty result offers a way back" depends on it.
