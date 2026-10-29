# vegdex

vegdex gathers recipes from all-vegan food blogs into one filterable catalog. It shows the facts a cook needs to choose and links back to the blog for the method.

## Catalog

**Source**:
An all-vegan publisher whose recipes vegdex crawls. Every recipe credits and links back to its source.
_Avoid_: Site, feed, provider

**Recipe**:
One dish from a source: its title, photo, facts and ingredient lines, never its method.
_Avoid_: Post, entry

**Shelf**:
All recipes from one source, opened from the source's name.
_Avoid_: Blog page, source view

**Vegan check**:
The publication gate that drops any recipe naming an animal product without a plant-based qualifier.
_Avoid_: Filter, validation

## Languages

**UI language**:
The language the app's own words are shown in, chosen by the URL prefix.
_Avoid_: Locale (in prose), site language

**Content language**:
The language a source writes its recipes in, stored on each recipe.
_Avoid_: Recipe locale, original language

**Concept**:
A language-neutral ingredient that an ingredient line refers to, such as chickpea, whatever language the line is written in.
_Avoid_: Canonical name, ingredient ID

**Language pack**:
Everything vegdex needs to parse and check recipes written in one content language, including its animal-word list.

**Vocabulary**:
Everything vegdex knows about one language's words, kept in git per language: aliases, concept names with their grammatical forms, preparation terms, unit labels and titles.
_Avoid_: Tables, translation memory, learned data

**Preparation term**:
A language-neutral note a cook needs, such as "minced" or "to taste", named in each language. Notes that are not terms are commentary.
_Avoid_: Note phrase

**Commentary**:
Note text that is not a preparation term, such as substitutions, brand advice or "see notes". Never displayed; the original line keeps it.
_Avoid_: Aside, extra note

**Gap**:
Something the vocabulary lacks: a phrase with no concept or term, a concept or term with no name in a language, or a title with no translation.
_Avoid_: Queue task, missing string

**Coverage**:
The share of ingredient lines and titles one language can show entirely from the vocabulary, for recipes written in another language.
_Avoid_: Translation progress

**Original text**:
A title or ingredient line exactly as the source wrote it, shown whenever the vocabulary cannot compose it in the page language.
_Avoid_: Raw text, source text

**Held recipe**:
A recipe that is crawled but not published until every ingredient maps to a concept.
_Avoid_: Pending, quarantined

**Fill**:
One round of answering gap batches and applying the answers, by any worker: an agent session, a local model or an API.
_Avoid_: Enrich run, translation job, sync
