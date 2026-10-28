---
title: Translated blog editions stay excluded even once vegdex is multi-language
author: Antonio
date: 2026-10-28
branch: multi-language-plan
cost: { minutes: 1, tokens: 1979 }
id: l-57b51e24
scope: repo
status: active
replaces: l-ec7a4bd1
src: agent
touches:
  - packages/ingest/src/sitemap.ts
---

## Decided
- Keep isOtherLanguage (packages/ingest/src/sitemap.ts) and the otherLanguage drop in emit.ts after multi-language ships. Recipes are rendered in every UI language through concepts (docs/adr/0003), so a /de/ edition of an English blog would only duplicate recipes vegdex already shows in German.
- New content languages arrive as original-language sources, each gated on a language pack with a tested animal-word list.

## Tried and ruled out
- The old rule "translating recipes is ruled out" was reversed on 2026-10-28. Translation goes through concept tables and a translation memory filled by an LLM, never as free text per build (ADR 0003, 0004).
