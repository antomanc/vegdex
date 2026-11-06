---
title: Record text and exact record concepts have separate jobs
author: Antonio
date: 2026-11-06
branch: lines/use-records
id: l-c877782f
scope: repo
status: active
src: agent
touches:
  - docs/review/italian-lines.md
  - packages/core/src/grocery.ts
  - packages/core/src/ingredient-display.ts
  - packages/core/src/ingredients/types.ts
  - packages/core/src/line-records.ts
  - packages/core/test/golden/ingredient-lines.json
  - packages/ingest/data/lines/07.jsonl
  - packages/ingest/data/lines/0e.jsonl
  - packages/ingest/data/lines/12.jsonl
  - packages/ingest/data/lines/14.jsonl
---

## Decided
Use record text for bilingual rendering while retaining parser measurements. The extra vegan gate checks only exact English concepts resolved from record names, independently of the parser fallback concept. Keep both original vegan checks.

## Tried and ruled out
Checking every concept on a part with record text excluded vegan meatballs and sausages: those parts had retained the parser's animal concept because their qualified record name had no exact lookup match. This was not new record evidence.

## Watch out
The emit CLI writes held and excluded reports beside its input store even with a separate output directory. Copy a read-only store into the workspace before invoking the CLI. Loading all validated records on the first fixture line also caused test timeouts; load validated shards on demand.

In the code: packages/core/src/line-records.ts, packages/ingest/src/prepare.ts, packages/ingest/src/line-records.ts, packages/ingest/src/cli.ts.
