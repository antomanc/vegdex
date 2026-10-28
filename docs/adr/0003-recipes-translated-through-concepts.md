# Recipes are translated through language-neutral concepts, not as text

This reverses the earlier English-only rule. Every recipe should be readable in every UI language, and sources may publish in languages other than English. Each ingredient line is parsed into a quantity, a unit, a concept, a note and the original text. Per-language tables (units, concept names with synonyms, note phrases) work in both directions: they render a line in any language, they turn an Italian search word into a concept, and they parse a recipe written in that language. Titles go through a translation memory, translated once per language and cached. The vegan check, tagger, search and shopping list work on concepts, so none of them need rewriting for a new language.

An LLM only fills table misses and new titles. Its output is stored and reused, so the cost tracks new strings, not recipes times languages. Agents write the tables; nobody reviews them row by row. Two safeguards replace that review. First, a hand-written list of animal words per language checks every rendered line and title, and any match without a plant-based qualifier falls back to the original text. Second, a recipe from a non-English source with an unmapped ingredient is held back, not published. Readers can report a recipe from its sheet, and confirmed reports go on a blocklist.

## Considered Options

- **UI-only translation, recipes stay English.** Cheap, but Italian search finds nothing and English-only sources limit the catalog.
- **A glossary of raw ingredient names.** `canonicalName` yields about 17,000 distinct names over 168k lines (October 2026), and 90% coverage needs about 4,000 of them. Lines would come out half translated. Concepts collapse those names into a few thousand entries per language.
- **Machine-translating whole lines on every build.** Costs grow with recipes times languages, and a dropped qualifier can turn "vegan butter" into "burro".

## Consequences

Translated editions of a blog (a `/de/` path on an English site) stay excluded: they repeat recipes we already render in every language. New content languages arrive as new sources, gated on a language pack with a tested animal-word list.
