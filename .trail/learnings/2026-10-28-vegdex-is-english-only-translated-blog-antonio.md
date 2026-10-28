---
title: "vegdex is English-only: translated blog editions are dropped, not translated"
author: Antonio
date: 2026-10-28
branch: card-file-identity
cost: { minutes: 5, tokens: 38464 }
id: l-ec7a4bd1
scope: repo
status: active
src: agent
touches:
  - apps/web/DESIGN.md
  - apps/web/src/app.css
  - apps/web/src/lib/RecipeCard.svelte
  - apps/web/PRODUCT.md
  - packages/ingest/src/cli.ts
  - packages/ingest/src/emit.ts
  - packages/ingest/src/sitemap.ts
  - packages/ingest/test/language.test.ts
---

## Decided
- Recipes from a translated edition of a blog (a `/de/` or `/fr-ca/` path) are never crawled (packages/ingest/src/sitemap.ts isOtherLanguage, used by isCandidateUrl) and stored copies are left out at emit (emit.ts, `otherLanguage` in the report). Only elavegan.com/de/ (526 recipes) matched in the Oct 2026 store.
- Why: classify() and findNonVegan read English ingredient names. On the German recipes, 222 were tagged nut-free while listing Mandeln/Nuss and 66 soy-free with Tofu/Soja; the vegan check could not see them either.

## Tried and ruled out
- Translating recipes: the user ruled it out (cost, accuracy, and the method stays on the blog anyway).
- Detecting language from ingredient text: worked (518 of 526) but is fuzzy; the URL path is exact for every source we crawl. Revisit if a source mixes languages without a path prefix.
