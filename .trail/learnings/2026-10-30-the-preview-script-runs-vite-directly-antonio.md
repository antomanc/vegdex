---
title: The preview script runs vite directly because pnpm moves its children into their own process groups
author: Antonio
date: 2026-10-30
branch: chore/e2e-json-preview-coverage-knip
cost: { minutes: 6, tokens: 53847 }
id: l-b468ec92
scope: repo
status: active
src: agent
touches:
  - scripts/preview.mjs
  - docs/agents/ui-verification.md
---

## Decided
`pnpm preview:start` spawns apps/web/node_modules/.bin/vite (the shim execs node, so the pid is the server) detached, and stop kills that process group. Starting while a preview runs stops it and rebuilds, so it never serves a stale bundle.

## Tried and ruled out
Spawning `pnpm --filter @vegdex/web preview` and killing pnpm's process group: pnpm 12 puts each child (its runner, the script shell, vite) in a new process group and adds a watchdog shell, so the recorded group never contained vite.

## Watch out
- A pid file below 2 is treated as junk: kill(-0) signals our own group and kill(-1) every process.
- A pid file older than the last boot is stale, since its pid may now belong to an unrelated process.
- start checks port 4173 is free before building; otherwise a foreign server answers the readiness check before vite fails on --strictPort.

In the code: scripts/preview.mjs running(), kill(), portFree().
