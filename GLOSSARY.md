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

**Translation memory**:
The cache of titles already translated, keyed by the original text and the target UI language.
_Avoid_: Translation cache, title table

**Original text**:
A title or ingredient line exactly as the source wrote it, always shown when no safe translation exists.
_Avoid_: Raw text, source text

**Held recipe**:
A recipe that is crawled but not published until its unmapped ingredients are mapped to concepts.
_Avoid_: Pending, quarantined

**Enrich run**:
A manual catch-up run on the owner's desktop that clears the queue of strings the tables could not handle.
_Avoid_: Translation job, sync
