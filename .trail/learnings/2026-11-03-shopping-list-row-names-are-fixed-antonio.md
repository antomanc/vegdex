---
title: "Shopping-list row names are fixed by a committed table, not a naming rule; suggestions are kept only if they find recipes"
author: Antonio
date: 2026-11-03
branch: fix/ingredient-names
cost: { minutes: 1, tokens: 2462 }
id: l-229e3a42
scope: repo
status: active
src: agent
touches:
  - packages/ingest/data/grocery-names.json
---

## Decided
- Bad shopping-list row names (#63) are fixed by packages/ingest/data/grocery-names.json (concept ID -> English row name), applied in emitDataset after groceryConcepts. Emit throws on an unknown concept. Only real fixes go in (typos, brands, misleading picks); hyphen-only spellings like "whole-wheat flour" stay computed.
- Two parser bugs behind odd names were fixed at the source: reduceAlternative kept only a-z, dropping accents ("b nh m sauce"); name-first "5 garlic cloves" kept "cloves" in the phrase after taking the clove as unit ("5 cloves garlic cloves") and filed 2,100 recipes under the garlic-clove concept instead of garlic. Size words are dropped there as measure-first lines already do; keeping "fat"/"x-large" lost 14 rendered lines.
- Filter suggestions (#67) are emitted as suggest/<lang>.json (~9 KB gz), fetched on first focus of an ingredient input, shown in a native datalist.

## Tried and ruled out
- Naming rows by the vocabulary name the catalog writes most: the vocabulary's names are its whole alias list, typos included ("gloves garlic" is one), so it picks the same names as the majority rule in groceryConcepts.
- Naming rows by the most written name overall: parsed names are reduced by canonicalName ("hot sauce" -> "sauce", "tamari" -> "soy sauce", "ground ginger" -> "ginger"), so rows collide with other concepts.
- Keeping only suggestions the lookup resolves: dropped 269 of 1,633 English names that do filter (by the ingredient-name text match). The check is searchRecipes(rows, { include: [name] }) finding a recipe.

## Watch out
- Verify parser or naming changes by emitting the real store (gh release download data --pattern store.json.gz --dir .data; pnpm ingest emit) before and after, diffing grocery names, recipe concepts, coverage.json and .data/excluded.json.
- Chrome fires a plain Event (no inputType) when a datalist option is picked; FilterBar treats that or insertReplacementText as a pick. Headless agent-browser cannot open the datalist popup, so picking on a real phone needs a manual check.
- Chrome draws a dropdown arrow on inputs with a list; app.css hides it.
