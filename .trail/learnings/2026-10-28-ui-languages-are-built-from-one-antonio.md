---
title: UI languages are built from one bundle; Paraglide runs offline with a local plugin and a page-declared locale
author: Antonio
date: 2026-10-28
branch: t3/italian-ui-paraglide-it-route
cost: { minutes: 5, tokens: 65137 }
id: l-37c5777a
scope: repo
status: active
src: agent
touches:
  - apps/web/.gitignore
  - apps/web/index.html
  - apps/web/messages/en.json
  - apps/web/messages/it.json
  - apps/web/package.json
  - apps/web/project.inlang/settings.json
  - apps/web/src/lib/i18n.ts
  - apps/web/src/lib/labels.ts
  - apps/web/src/lib/locales.ts
  - apps/web/tsconfig.app.json
---

## Decided
- Each UI language is its own page cut from the same JS bundle: index.html carries %LANG%/%TITLE%/%DESCRIPTION% placeholders and the vegdex-seo plugin's generateBundle (order 'post') fills them from messages/<code>.json, writing /index.html and /<prefix>/index.html (apps/web/vite.config.ts). Robots/sitemap are emitted in the same hook.
- The locale is whatever <html lang> says (apps/web/src/lib/i18n.ts, overwriteGetLocale, strategy ['baseLocale']). Components import `m` from lib/i18n so the locale is set before module-level label arrays such as MEAL_LABELS evaluate.
- The registry (src/lib/locales.ts) must stay free of workspace imports: vite.config.ts imports it, and the node tsconfig can't resolve @vegdex/core.

## Tried and ruled out
- Paraglide's default settings.json loads plugin-message-format from cdn.jsdelivr.net at compile time; instead @inlang/plugin-message-format is a devDependency referenced by node_modules path, so builds work offline.
- Paraglide's url strategy: it would break under BASE_PATH and isn't needed when the language is fixed per page.

## Watch out
- project.inlang/settings.json lists the locales a second time; vite.config.ts throws if it differs from the registry.
- Missing keys in a non-base messages file fall back to English silently; nothing fails the build yet (story 19 is open).
- src/paraglide/ is generated: `pnpm typecheck` compiles it first, and tsconfig.app.json excludes its server.js (needs node types).
