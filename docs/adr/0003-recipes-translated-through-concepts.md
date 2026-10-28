# Recipes are translated through language-neutral concepts, not as text

This reverses the earlier English-only rule. Every recipe should be readable in every UI language, and sources may publish in languages other than English. Each ingredient line is parsed into a quantity, a unit, a concept, a note and the original text. Per-language tables (units, concept names with synonyms, note phrases) work in both directions: they render a line in any language, they turn an Italian search word into a concept, and they parse a recipe written in that language. Titles go through a translation memory, translated once per language and cached. The vegan check, tagger, search and shopping list work on concepts, so none of them need rewriting for a new language.

The tables are seeded from the Open Food Facts ingredient taxonomy, an offline multilingual dictionary of about 6,800 ingredients with synonyms. Exact name matches alone cover 72% of catalog lines in October 2026. Vegan-qualified ingredients (vegan butter, plant milk, vegan parmesan) are the main misses and are never matched loosely: they get their own seed entries, because a loose match would land on the animal product. An LLM only fills what the seeds and the taxonomy miss, plus new titles. Its output is stored and reused, so the cost tracks new strings, not recipes times languages. Agents write the tables; nobody reviews them row by row. Two safeguards replace that review. First, a hand-written list of animal words per language checks every rendered line and title, and any match without a plant-based qualifier falls back to the original text. Second, a recipe from a non-English source with an unmapped ingredient is held back, not published. Readers can report a recipe from its sheet, and confirmed reports go on a blocklist.

## Considered Options

- **UI-only translation, recipes stay English.** Cheap, but Italian search finds nothing and English-only sources limit the catalog.
- **A glossary of raw ingredient names.** Parsed lines yield 10,429 distinct names over 168k lines (October 2026); 318 cover 80% and 1,006 cover 90%. A raw-name glossary would still miss synonyms, cross-language parsing and vegan flags, which concepts carry.
- **Machine-translating whole lines on every build.** Costs grow with recipes times languages, and a dropped qualifier can turn "vegan butter" into "burro".

## Consequences

Translated editions of a blog (a `/de/` path on an English site) stay excluded: they repeat recipes we already render in every language. New content languages arrive as new sources, gated on a language pack with a tested animal-word list.

The Open Food Facts database is under the ODbL: vegdex credits it, and the derived tables stay public under the same terms. Wikidata (CC0) is the fallback if the taxonomy's terms turn out not to fit.
