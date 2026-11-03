---
title: "No explainer sentences on the browse screen; the recipe sheet's creator action explains the handoff"
author: Antonio
date: 2026-11-03
branch: fix/drop-discovery-hint
cost: { minutes: 4, tokens: 13195 }
id: l-cb8a33db
scope: repo
status: active
src: agent
touches:
  - apps/web/messages/en.json
  - apps/web/messages/it.json
  - apps/web/src/App.svelte
  - apps/web/src/app.css
  - docs/research/pre-promotion-plan.md
---

## Decided
The browse screen carries no muted "how this works" sentence. The handoff to the creator is explained where it happens: the recipe sheet's "Cook it on <blog>" action and the creator credit under the ingredients.

## Tried and ruled out
A line above the filters, "Find a recipe here. Get the instructions on the creator's site." (Italian: "Trova qui la ricetta. Per il procedimento, visita il sito di chi l'ha creata."), added for plan item N2. The user called it bad UI: it read as a disclaimer, sat between the search and the filters, and took two lines in Italian.

## Watch out
If new users really do expect the method inside vegdex, solve it inside the recipe sheet, not with copy on the browse screen.

In the code: apps/web/src/App.svelte (main, above .filters), docs/research/pre-promotion-plan.md item N2.
