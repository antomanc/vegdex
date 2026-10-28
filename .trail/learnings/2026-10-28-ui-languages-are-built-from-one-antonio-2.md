---
title: UI languages are built from one bundle; Paraglide runs offline; the English units default follows the browser region
author: Antonio
date: 2026-10-28
branch: t3/review-italian-ui-fixes
cost: { minutes: 20, tokens: 150000 }
id: l-868d6a2c
scope: repo
status: active
replaces: l-37c5777a
src: agent
touches:
  - apps/web/vite.config.ts
  - apps/web/src/lib/locales.ts
  - apps/web/src/lib/state.svelte.ts
  - apps/web/src/lib/i18n.ts
---

## Decided
- Each UI language is its own page cut from the same JS bundle: index.html carries %LANG%/%TITLE%/%DESCRIPTION% placeholders and the vegdex-seo plugin's generateBundle (order 'post') fills them from messages/<code>.json, writing /index.html and /<prefix>/index.html plus a manifest, hreflang alternates and sitemap entries per locale (apps/web/vite.config.ts). The origin stays the single `siteUrl`; robots.txt and sitemap.xml remain build output.
- The locale is whatever <html lang> says (apps/web/src/lib/i18n.ts, overwriteGetLocale, strategy ['baseLocale']). Components import `m` from lib/i18n so the locale is set before module-level label arrays such as MEAL_LABELS evaluate.
- The registry (src/lib/locales.ts) must stay free of workspace imports: vite.config.ts imports it, and the node tsconfig can't resolve @vegdex/core.
- Default units come from the registry: Italian is 'metric', English is 'region' (cups for an en-US browser, grams for every other browser, as before). A stored choice wins on every page.
- Manifest `name` is its own message (manifest_name), not the page title: the English install name stays "vegdex: vegan recipes".

## Tried and ruled out
- Paraglide's default settings.json loads plugin-message-format from cdn.jsdelivr.net at compile time; instead @inlang/plugin-message-format is a devDependency referenced by node_modules path, so builds work offline.
- Paraglide's url strategy: it would break under BASE_PATH and isn't needed when the language is fixed per page.
- Registry units 'us' for English: it made en-GB and it-IT browsers start in cups on `/`, changing the English site. The old "outside the US starts in metric" e2e test was rewritten to match and had to be restored.

## Watch out
- project.inlang/settings.json lists the locales a second time; vite.config.ts throws if it differs from the registry.
- Paraglide silently falls back to English for a missing key, so vite.config.ts checks every messages file against the union of keys and fails the build.
- src/paraglide/ is generated: `pnpm typecheck` compiles it first, and tsconfig.app.json excludes its server.js (needs node types).
- `trail check` flags the sitemap/robots lines in vite.config.ts and seo.spec.ts as "bringing back" the ruled-out static files; those are false positives, they are still emitted by the build.
