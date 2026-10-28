---
title: "The phone header row is at capacity; theme tokens use data-theme, not light-dark()"
author: Antonio
date: 2026-10-28
branch: night-mode-switch
cost: { minutes: 4, tokens: 34007 }
id: l-6f51b187
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/index.html
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - apps/web/src/lib/Icon.svelte
  - apps/web/src/lib/theme.svelte.ts
  - e2e/browse.spec.ts
---

## Decided
- Night mode keys off `:root[data-theme]` (set before paint by an inline script in apps/web/index.html, then lib/theme.svelte.ts), so the dark tokens stay one block in app.css.

## Tried and ruled out
- CSS `light-dark()` per token: no duplication, but Safari before 17.5 drops the whole value, leaving the app uncolored. Duplicating the dark block under both a media query and an attribute was the other option; the attribute alone avoids it.

## Watch out
- The header's brand row (wordmark, Filters jump, Night mode, Saved) just fits at 360px, and only because Saved collapses to "♥ 3" under 420px (`.tight-hide` in app.css). Any new header control will overflow; measure `.brand-row` scrollWidth vs clientWidth at 360px with the Filters jump showing (scroll past the filters).
