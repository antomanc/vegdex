# Ingredient lines are composed from a vocabulary kept in git, and any worker fills its gaps

This supersedes how ADR 0004 stores what the model learns, and refines ADR 0003's per-language tables. Lines were translated whole or not at all: a line rendered in Italian only when its ingredient matched exactly and its note string already had a translation. Everything else fell back to the original line, and in metric mode the fallback still converted the amount. The result mixed languages within one ingredient list ("≈ 55 g oil for frying" under "≈ 45 g amido di mais"). Notes were free text keyed by their exact spelling, so the queue held 36,000 Italian note tasks and would repeat them for every new language. A 56 MB queue and a learned-data release asset, merged on every nightly and desktop run, had never published an entry.

An ingredient line is now `amount + unit + concept(s) + preparation terms`. Preparation terms are a vocabulary with IDs like concepts ("minced", "drained and rinsed", "to taste"). Anything else in a note is commentary and is never displayed: substitutions, brand advice, cross-references. Words written around the name that are terms ("chopped scallion") are peeled off only when the rest is a known ingredient, and "salt and pepper" becomes two concepts only when both sides are known exactly. In its own language a line keeps its written words minus commentary. In another language every part comes from the vocabulary, or the whole line stays as written, units included. A line is never half-translated.

Each language has one file, `packages/ingest/data/vocab/<lang>.json`, with aliases, concept names, term names, unit labels, titles and known commentary. Names carry grammatical forms (singular, plural, gender), and terms agree with them, so Italian reads "2 cipolle" and "1 cipolla, tritata". Concepts the taxonomy lacks live in `vocab/concepts.json` with an unknown vegan status. Git is the only home: no release asset, no stored queue. The build derives gaps and a coverage score per language from the catalog and the vocabulary.

Filling gaps has one contract for every worker. `pnpm gaps` writes batch files with their instructions, any worker writes answers, and `pnpm vocab:apply` checks each answer and merges what passes. Workers can be an agent session, a local model or an API (`pnpm enrich`). The checks live in one place, and a test runs them over the committed files. Mapping a name to a concept happens once per source language; naming happens once per concept and display language.

## Considered Options

- **Keep translating notes as strings.** It is simple, but the work grows with distinct spellings × languages, and long notes stay untranslated.
- **Keep learned data in a release asset.** It is not reviewable, needs merge logic between nightly and desktop runs, and it is easy to lose.
- **Show commentary as an aside in its original language.** Lines stay complete, but they look mixed again; removing it keeps every line short and clean.
- **Use Open Food Facts names as display text.** They are inconsistent in number and carry no gender, which produced "2 cipolla". They are now hints for the naming task.

## Consequences

A concept renders in a language only once it has forms there, so coverage starts low and rises with each fill run. Same-language display improves at once, because it needs only terms and unit labels. The nightly issue reports scores and the largest gaps instead of queue counts. Each held recipe is mentioned once, without the seven-day grace period, because the store records no first-held date.
