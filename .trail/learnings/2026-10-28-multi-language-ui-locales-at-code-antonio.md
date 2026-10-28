---
title: "Multi-language: UI locales at /<code>/ via Paraglide; a full ingredient display glossary does not scale"
author: Antonio
date: 2026-10-28
branch: main
cost: { minutes: 1, tokens: 1972 }
id: l-a8528a3c
scope: repo
status: active
src: agent
touches:
  - docs/research/seo-guidance.md
  - packages/core/src/ingredients.ts
  - apps/web/PRODUCT.md
---

## Decided
- Italian is the first of several UI languages, so nothing may assume a single extra language.
- URL: English at the root, other languages under a path prefix (/it/), each built as its own index.html with lang and reciprocal hreflang (see docs/research/seo-guidance.md). No automatic redirect from navigator.language; only a dismissible one-time "Disponibile in italiano" link.
- UI strings go through Paraglide JS 2 (the user wanted a small library so adding languages is easy), with en.json as the source and one messages file per locale. Formatting stays on Intl.
- Italian copy is drafted by AI agents using the humanizer skill; no machine-translation service runs in the build.
- On /it/, metric units are the default until the user changes the toggle. Saved recipes, the shopping list and the units choice live in shared localStorage across languages.
- URL query params stay English identifiers (meal=dessert); only the labels shown on screen are translated.
- Translated surface: labels, aisle headings, badges, meta tags, JSON-LD inLanguage, a manifest per locale with its own start_url, and sitemap entries. "vegdex" and blog names are never translated.

## Tried and ruled out
- A full English-to-Italian display glossary for ingredient lines. canonicalName (packages/core/src/ingredients.ts) gives 17,255 distinct names over about 168k lines in the Oct 2026 catalog. The top 1,357 cover 80% of lines and about 3,945 are needed for 90%, so translated lines would come out mixed ("400 g ceci, drained and rinsed") and every new language would cost about 4k entries to review.

## Watch out
- Machine-translating ingredient lines can drop a plant-based qualifier ("vegan butter" becoming "burro"), which breaks the vegan-certainty principle in apps/web/PRODUCT.md. Any future translation needs a vegan check run on the translated output.
