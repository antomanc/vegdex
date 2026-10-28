---
title: SEO origin lives once in vite.config.ts; robots.txt and sitemap.xml are build output
author: Antonio
date: 2026-10-28
branch: seo-foundations
cost: { minutes: 5, tokens: 69672 }
id: l-4edd6e5e
scope: repo
status: active
src: agent
touches:
  - apps/web/index.html
  - apps/web/vite.config.ts
  - docs/research/seo-audit.md
  - e2e/seo.spec.ts
---

## Decided
- The preferred origin (https://vegdex.antomanc.com/) is defined once as `siteUrl` in apps/web/vite.config.ts. The `vegdex-seo` plugin fills `%SITE_URL%` into index.html (canonical, og:url, og:image, JSON-LD) and emits robots.txt and sitemap.xml at build. A domain change is a one-line edit there. e2e/seo.spec.ts still hardcodes the production origin on purpose, as a pin.
- PRODUCT.md now says "Currently English only… language expansion will be designed separately". The user confirmed this reopening on purpose: other languages come later, in their own design session. Translated editions stay out of the catalog until then.

## Tried and ruled out
- Static public/robots.txt and public/sitemap.xml: the origin was repeated in 7 places, so they were dropped for the plugin.

## Watch out
- robots.txt and sitemap.xml exist only in `vite build` output; `pnpm dev` does not serve them. e2e runs against the built preview, so it covers them.
- The service-worker navigation fallback denies both files (vite.config.ts navigateFallbackDenylist). e2e blocks service workers, so no test covers that.
