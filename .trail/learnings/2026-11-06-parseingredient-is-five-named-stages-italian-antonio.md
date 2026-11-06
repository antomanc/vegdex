---
title: parseIngredient is five named stages; Italian shapes live in the language pack
author: Antonio
date: 2026-11-06
branch: refactor/parser-stages
id: l-e2004d52
scope: repo
status: active
src: agent
touches:
  - packages/core/src/ingredients.ts
  - packages/core/src/languages.ts
---

## Decided
- parseIngredient (packages/core/src/ingredients.ts) is a short orchestrator that runs five named stages in order — normalise, amount, name-and-notes, resolve, classify — each a typed function over one shared ParseState, split across packages/core/src/ingredients/{normalise,amount,name,resolve,classify}.ts. Leaf helpers live in {types,units,measure,names}.ts. No stage function is over 80 lines.
- Italian-specific parsing moved into the language pack: italianShapes is pack.shapes, the circa prefix is pack.circa and the post-unit fill words are pack.fillNote (packages/core/src/languages.ts), so the stages stay language-neutral. The public @vegdex/core surface is unchanged.
- Verified behaviour-identical, not just typechecked: pnpm parse:diff origin/main reports 0 changed over 114,919 distinct lines and pnpm golden reports 0 changed.

## Watch out
- Older learning l-29c56b21 says Italian shapes are in ingredients.ts; they now live in languages.ts as pack.shapes/circa/fillNote.
