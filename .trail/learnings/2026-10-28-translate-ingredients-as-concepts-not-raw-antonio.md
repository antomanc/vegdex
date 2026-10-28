---
title: "Translate ingredients as concepts, not raw names: 17k raw names collapse into a few thousand concepts"
author: Antonio
date: 2026-10-28
branch: multi-language-plan
cost: { minutes: 1, tokens: 9388 }
id: l-d4fc1595
scope: repo
status: active
replaces: l-a8528a3c
src: agent
touches:
  - packages/core/src/ingredients.ts
---

## Decided
- Ingredient lines are translated through language-neutral concepts with per-language tables (docs/adr/0003). UI languages live under path prefixes with Paraglide (docs/adr/0002).

## Tried and ruled out
- A glossary keyed on canonicalName output (packages/core/src/ingredients.ts): 17,255 distinct names over about 168k lines in the October 2026 catalog. The top 1,357 cover 80% of lines, and about 3,945 are needed for 90%, so lines came out half translated ("400 g ceci, drained and rinsed").

## Watch out
- A translated line can drop a plant-based qualifier ("vegan butter" becoming "burro"). Every rendered line and title must pass the per-language animal-word check, falling back to the original text on a match.
