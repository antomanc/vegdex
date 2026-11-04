---
title: "A source over 10% on the vegan check gets a warning; Italian bracket notes stay flagged on purpose"
author: Antonio
date: 2026-11-04
branch: feat/exclusion-rate-warning
cost: { minutes: 20, tokens: 74868 }
id: l-e1742393
scope: repo
status: active
src: agent
touches:
  - packages/core/src/languages.ts
  - packages/core/test/vegan.test.ts
  - packages/ingest/src/cli.ts
---

## Decided
The daily emit warns when more than 10% of a source's recipes are flagged by the vegan check, since a jump means the blog may have stopped being all-vegan. On first run it fired for Cucinaverza (12%), and every flagged recipe was an Italian false positive. "veg" after a dairy word and fruit or nut butters ("burro di mele", "burro di nocciole", "burro di frutta secca") now count as plant-based, which put Cucinaverza back under the line (15 flagged).

## Tried and ruled out
Accepting a plant word inside brackets ("yogurt (per me vegetale)", "latte (per me di soia)"): the Italian check splits brackets into separate parts, and that same split guards rendered translations, so loosening it there needs its own review. Those lines stay excluded.

## Watch out
Cucinaverza sits just under 10%; a few more bracket-style recipes will bring the warning back. That means reviewing the lines, not dropping the source. Commentary that mentions a dairy word ("ricorda il formaggio") is also still flagged.

In the code: packages/ingest/src/cli.ts emit() warning (excluded entries are matched to sources by URL host); packages/core/src/languages.ts Italian qualifierSuffix; tests in packages/core/test/vegan.test.ts.
