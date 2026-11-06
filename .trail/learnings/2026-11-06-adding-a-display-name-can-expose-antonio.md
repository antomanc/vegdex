---
title: Adding a display name can expose ingredient losses hidden by a fallback
author: Antonio
date: 2026-11-06
branch: fix/italian-composition
id: l-64c8046f
scope: repo
status: active
src: agent
touches:
  - e2e/fixtures/data/dictionary.json
  - e2e/fixtures/data/lookup/en.json
  - e2e/fixtures/data/lookup/it.json
  - e2e/fixtures/data/overlay/en.json
  - e2e/fixtures/italian-data/dictionary.json
  - e2e/fixtures/italian-data/lookup/en.json
  - e2e/fixtures/italian-data/lookup/it.json
  - e2e/fixtures/italian-data/overlay/en.json
  - packages/ingest/data/vocab/it.json
  - packages/ingest/src/vocab-check.ts
---

## Decided
Review newly composed lines after a vocabulary fill, even when parse:diff is empty. A display-only change can make existing parser losses visible. Keep a fallback when a candidate exposes an unresolved loss.

## Tried and ruled out
Italian names for pea shoots and pickle relish were withheld after a 60-line sample. A pea-shoot line also naming mint and dill rendered only pea shoots. Relish alternatives applied preparations across both alternatives and produced misleading wording. Neither was dismissed as audit wording noise.

## Watch out
The apply-time check alone did not catch two mustard concepts acquiring the same Italian name; the whole-vocabulary check caught the ambiguity after reload. Run the committed-vocabulary tests too. An attempted vegan-meatball name was correctly rejected as an animal concept; do not bypass that check.

In the code: packages/ingest/src/vocab-check.ts, packages/ingest/test/vocab.test.ts, packages/ingest/data/vocab/it.json. Compare every new audit flag and newly composed line; unchanged parser output does not prove newly enabled Italian output is complete.
