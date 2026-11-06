---
title: Alias validation needs separate old and new vocabularies
author: Antonio
date: 2026-11-06
branch: vocab/reviewed-aliases
id: l-7e251e81
scope: repo
status: active
src: agent
touches:
  - packages/ingest/src/parse-diff.ts
---

## Decided
Compare parsing with separate old and new vocabularies when reviewing ingredient aliases. Review every affected original line because a synonym can enable composition which drops preparation or alternatives, or changes splitting. Reject aliases that expose those losses.
## Tried and ruled out
Using parse-diff alone cannot validate vocabulary changes: it supplies today's vocabulary to both parsers. Auditor-cleaned names cannot establish that a parser phrase is a complete synonym, because cleanup can conceal an isolated fragment.
## Watch out
Existing Italian concept names can lose purchase distinctions even when an alias targets the correct English concept. Replacing existing aliases also changes shopping identity and requires a separate decision.
In the code: packages/ingest/src/parse-diff.ts loads one vocabulary for both parsers. Supplement pnpm parse:diff with parseLine comparisons against separate loadVocabulary snapshots.
