---
title: Animal-word lists need an accent-aware end boundary and avoid words that name plant foods
author: Antonio
date: 2026-10-29
branch: main
cost: { minutes: 1, tokens: 1119 }
id: l-ce172676
scope: repo
status: active
src: agent
touches:
  - packages/core/src/translations.ts
  - packages/core/src/languages.ts
---

## Decided
- The animal-word lists are the only text check for original Italian content, so missing words can publish non-vegan recipes. They were widened after review (cured meats, seafood, buttermilk, mayonnaise, worcestershire and similar).
- The English display list leaves out "meat" and "steak", because coconut meat, jackfruit meat and cauliflower or tofu steak are common plant foods. A false hit only falls back to the original text, but it would hide good translations.

## Watch out
- In a JavaScript regex without the u flag, \b is ASCII-only. A word that ends in an accented letter ("baccalà") never matches when the list ends in \b, so the test fails with no obvious cause in the diff.

In the code:
- The Italian list in packages/core/src/languages.ts (animalWords) ends in (?![\wà-ÿ]) instead of \b.
- Regression lists: packages/core/test/translations.test.ts and packages/core/test/languages.test.ts.
