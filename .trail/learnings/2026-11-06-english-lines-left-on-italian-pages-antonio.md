---
title: "English lines left on Italian pages are a long tail that rules, vocabulary and aliases cannot close"
author: Antonio
date: 2026-11-06
branch: vocab/reviewed-aliases
id: l-9506aca8
scope: repo
status: active
src: agent
touches:
  - packages/ingest/data/vocab/en.json
  - packages/core/src/ingredients/name.ts
---

## Decided
Stop chasing the share of English lines on Italian pages with more parser or vocabulary work. After amounts, line splitting, a purpose rule, seven Italian names and 28 aliases it moved only from 4.74% to about 4.67% of line uses and from 40.1% to about 39.8% of English recipes.

## Tried and ruled out
More parser rules: the best careful rule gained 95 uses, and broader versions swallowed powdered sugar, salt and soaking times.
Filling Italian names: seven recurring names gained 55 uses; about 3,450 unknown names remain, and 1,000 of them cover under half.
"Longest known name inside the phrase": turned "no-chicken broth" into broth and "vegan mozarella cheese" into cheese.
Bulk aliases from the audit: 1,388 candidates looked like 3,800 uses, but only 28 were true synonyms. The rest were sentence fragments, measures, notes, purposes and alternatives.

## Watch out
A simulation that treats an auditor's clean name as a fix overstates the gain by far: it predicted 2.90% and delivered 4.73%. Review a sample of candidates before planning around such a number.

In the code: packages/ingest/data/vocab/en.json, packages/core/src/ingredients/name.ts.
