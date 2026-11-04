---
title: "A local crawl starts from the release store with --pull; veganhuggs' sitemap fails only in CI"
author: Antonio
date: 2026-11-04
branch: main
id: l-ee930cf1
scope: repo
status: active
src: agent
touches:
  - packages/ingest/src/cli.ts
  - README.md
---

## Decided
`pnpm ingest run --pull` downloads `.data/store.json.gz` from the `data` release before crawling, so an on-demand crawl on this machine starts where the daily workflow left off. Without it an empty store means re-crawling every URL, rate-limited at one request per second per host.

## Tried and ruled out
Reading "no sitemap entries found" as the blog having no posts: veganhuggs discovers 316 URLs and crawls from home, while every Actions run since 2026-10-28 reports 0 URLs, so the runner is being blocked at sitemap fetch, not the parser. A local crawl of it fetched 0 pages anyway because its post-sitemap lastmod is 2026-10-02.

## Watch out
`discover()` in packages/ingest/src/crawl.ts swallows sitemap fetch errors (`.catch(() => null)`), so a blocked sitemap looks the same as an empty one in the crawl report. A local crawl only writes `.data/`; production still deploys from the store in the release, so publishing an on-demand crawl needs the store uploaded there and the workflow dispatched with `crawl=false`.
