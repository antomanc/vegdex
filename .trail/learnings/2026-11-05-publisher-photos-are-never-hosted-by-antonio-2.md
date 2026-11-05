---
title: "Publisher photos are never hosted by vegdex, and blogs can see and refuse vegdex's image requests"
author: Antonio
date: 2026-11-05
branch: main
cost: { minutes: 1, tokens: 7823 }
id: l-dabad105
scope: repo
status: active
replaces: l-a97a25c7
src: agent
touches:
  - scripts/share-card.mjs
  - packages/ingest/data/blocklist.json
---

## Decided
- Photos load only from the publisher. The share cards are hosted by vegdex, so they carry no publisher photos.
- Images use the browser's default referrer policy. `no-referrer` could get past a blog's hotlink rules, and EU case law (VG Bild-Kunst) ties liability for embedding to getting around technical protections.
- Publishers ask for removal by email, because a GitHub issue would need an account many bloggers lack.
- Git history was not rewritten to drop the old share images: forks and pull request refs would keep them, and every commit link would break. If a publisher objects, GitHub Support can purge the blobs.

## Watch out
- The e2e fixture route serves a real image for example.com: a 404 logs a console error, which fails specs asserting a clean console.
- Lazy images below the fold never fire onerror when blocked, so the share script waits only on the first four cards.

In the code: scripts/share-card.mjs, apps/web/public/share-*.png, RecipeCard.svelte, RecipeSheet.svelte, REMOVAL_URL in App.svelte, packages/ingest/data/blocklist.json for removed recipes, e2e/photos.spec.ts.
