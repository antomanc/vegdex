---
title: First-visit data is re-fetched through the service worker so the app works offline
author: Antonio
date: 2026-11-03
branch: worktree-agent-a8b17dd650ccdfc76
cost: { minutes: 17, tokens: 138804 }
id: l-9a3709ad
scope: repo
status: active
src: agent
touches:
  - apps/web/src/main.ts
  - playwright.config.ts
---

## Decided
registerSW.js registers the worker on window load, so on a first visit catalog.json, first.json, lookup and overlay (and a detail shard opened early) are fetched before the worker controls the page and never reach the vegdex-data StaleWhileRevalidate cache. Offline after one visit showed "Couldn't load the recipes". apps/web/src/main.ts listens for the first controllerchange and re-fetches every /data/ resource that started before it, using a buffered PerformanceObserver so requests still in flight at that moment are included.

## Tried and ruled out
Scanning performance.getEntriesByType once at controllerchange: a detail shard still in flight was missed, about 1 run in 10 under --repeat-each.
Routing the fixtures with context.route for service-worker requests: still experimental in Playwright 1.64 (PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS).

## Watch out
- The offline test runs in its own Playwright project ("offline", serviceWorkers allow, port 4175). e2e/offline-server.ts serves apps/web/dist with e2e/fixtures/data at /data/, reads lazily and answers 404 until the main webServer has built dist, so the two servers need no ordering.
- reuseExistingServer is on locally: another worktree running e2e on port 4174 gets reused, and then this checkout's dist is not rebuilt. Check `ss -ltnp | grep 4174` when results look stale.
