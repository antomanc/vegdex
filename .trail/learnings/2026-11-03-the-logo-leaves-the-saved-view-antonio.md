---
title: "The logo leaves the saved view and a blog's shelf but keeps the cook's filters"
author: Antonio
date: 2026-11-03
branch: design/critique-fixes
cost: { minutes: 1, tokens: 8257 }
id: l-dd6b011c
scope: repo
status: active
src: agent
touches:
  - apps/web/src/App.svelte
  - e2e/language-switch.spec.ts
  - e2e/browse.spec.ts
---

## Decided
The logo button ("vegdex, all recipes") clears only the Saved view and the blog shelf (`from`). Search, meals, time and free-from stay.

## Tried and ruled out
Making the logo a full reset (clear search and every filter): it broke the language-switch flow, which leaves Saved through the logo and expects its filters to carry to the other language's link.

## Watch out
"Pick for me" moved out of the filter row into a floating dock at the bottom, so solid ink green in the row now only means "selected"; don't put a solid action back in that row.

In the code: apps/web/src/App.svelte home(); e2e/language-switch.spec.ts (first test); e2e/browse.spec.ts "the logo leaves a blog shelf for all recipes".
