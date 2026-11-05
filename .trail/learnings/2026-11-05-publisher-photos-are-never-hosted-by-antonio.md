---
title: "Publisher photos are never hosted by vegdex, and image requests name vegdex so hotlink blocks apply"
author: Antonio
date: 2026-11-05
branch: main
cost: { minutes: 19, tokens: 197817 }
id: l-a97a25c7
scope: repo
status: active
src: agent
touches:
  - scripts/share-card.mjs
  - packages/ingest/data/blocklist.json
  - apps/web/public/share-en.png
---

## Decided
- Photos load only from the publisher. The share cards (scripts/share-card.mjs, apps/web/public/share-*.png) are hosted by vegdex, so they refuse every non-localhost request and show the leaf placeholder.
- Images use the browser's default referrer policy. `no-referrer` was removed from RecipeCard and RecipeSheet because it could get past a blog's hotlink rules; EU case law (VG Bild-Kunst) ties liability for embedding to getting around technical protections.
- Publishers ask for removal through the footer link, a prefilled GitHub issue. Removed recipes go in packages/ingest/data/blocklist.json.

## Watch out
- Removing the share photos from the current files does not remove them from git history.
- The e2e fixture route serves a real image for example.com: a 404 logs a console error, which fails specs asserting a clean console.
- Lazy images below the fold never fire onerror when blocked, so share-card.mjs waits only on the first four cards.
