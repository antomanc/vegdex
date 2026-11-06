# Ingredient lines are read once by a model and saved as records in git

A line is read by a model once, then saved as a structured record in git. Deterministic code owns everything a reader needs to trust: amounts, unit conversion, scaling, the shopping list, and the raw vegan check. The record only says what each part of a line is and how to write it, in English and Italian. `applyLineRecord` overlays that on the parser's measurements, so a record cannot move an amount or hide an animal product the parser found.

Rules, vocabulary and aliases could not close the gap. They got there slowly, one spelled phrase at a time, and a new phrase fell back to the original line until someone noticed it. Measured on 342 blind lines, the model read 26 wrong where the rules path read 147 wrong. With records, English lines left on Italian pages fell from 4.56% to 0.40%, and recipes carrying any untranslated line from 39.0% to 4.8%. About 23 new distinct lines arrive a day, so the backlog keeps moving.

This supersedes the parts of ADR 0004 and ADR 0005 that kept model output off the site: model output now ships, but only as reviewed records behind the deterministic checks. `pnpm lines:fill` gives a line its record with one small flow that mirrors the vocabulary contract (see docs/agents/vocabulary.md).

## Consequences

A line with no record still parses and publishes through the old rules path, so a new recipe is never held waiting for its record. Records live in `packages/ingest/data/lines/`, sharded by a hash of the line, and every committed record passes `validateRecord`. The nightly backlog reports how many catalog lines still have none.
