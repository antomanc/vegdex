---
title: "Ingredient lines are composed from a per-language vocabulary in git, never half-translated"
author: Antonio
date: 2026-10-29
branch: feature/vocabulary-translations
cost: { minutes: 35, tokens: 408364 }
id: l-813a5a36
scope: repo
status: active
src: agent
touches:
  - packages/core/src/vocabulary.ts
  - packages/core/src/ingredient-display.ts
  - packages/core/test/ingredient-display.test.ts
  - packages/core/src/ingredients.ts
  - packages/ingest/src/vocab.ts
  - packages/ingest/src/prepare.ts
  - packages/ingest/src/gaps.ts
  - packages/ingest/src/vocab-check.ts
  - packages/ingest/src/fill.ts
  - packages/ingest/src/enrich.ts
---

## Decided
- The Italian "slop" had two causes: lines translated only when the whole note string had a translation (36k unique notes queued), and the cross-language fallback still converted amounts to grams while keeping the English name ("≈ 55 g oil for frying").
- A line is amount + unit + concept(s) + preparation terms. Notes that are not terms are commentary and are dropped in every language (the user chose removal over an aside). In another language every part comes from the vocabulary or the whole line stays as written, units included.
- Names carry grammatical forms ({one, other, gender}); terms agree with them. Open Food Facts names are parse aliases and naming hints only, never display text, because they gave "2 cipolla".
- Git is the only home for what models learn (supersedes ADR 0004 storage). The queue is derived, not stored. Every worker (agent session with Haiku subagents, local LLM, API) uses gaps → answers → vocab:apply; the checks live in vocab-check.ts and a test runs them over the committed files.
- Goal agreed with the user: unknown-ingredient lines under 1% per display language, reached through fill runs after the PR.

## Tried and ruled out
- Translating notes as free strings, a learned-data release asset, showing commentary as a muted aside, and the per-task model evaluation harness (removed with the queue model).

## Watch out
- Agreeing forms surfaced plural animal words the Italian list missed ("polli", "salami"); the list now pluralizes meats and fish. "latte d'avena" needed the elided d' in the plant qualifier.
- "Romano or Ramiro pepper" must never split into Romano cheese + pepper: the and/or split is skipped when the shared-noun rule matched. The split's second concept must also go through findNonVeganConcepts.
- Vocabulary.lookup() is cached per language; reload the vocabulary after applying answers in the same process.
- Some English-labelled sources contain German lines ("nach geschmack", "TL"); they never parse and count as unknown.

In the code: packages/core/src/{vocabulary,ingredient-display,ingredients}.ts, packages/ingest/src/{vocab,vocab-check,fill,gaps,prepare,vocab-cli}.ts, packages/ingest/data/vocab/, docs/adr/0005, docs/agents/vocabulary.md, e2e/no-mixed-lines.spec.ts.
