# Ingredient dictionary (#24)

The offline seed uses the Open Food Facts ingredient taxonomy, credited to **Open Food Facts contributors**. The taxonomy, generated concept tables, committed additions, alias indexes and OFF-derived mappings in emitted datasets are available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/); individual database contents use the [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/). Copies of both licenses are in this directory. Recipe text and images retain their publishers' rights.

## Provenance and license evidence

Verified against primary sources on 2026-10-28:

- [Pinned taxonomy](https://github.com/openfoodfacts/openfoodfacts-server/blob/2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae/taxonomies/food/ingredients.txt): `ingredients.off.txt` is the unmodified offline copy at server revision `2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae`. SHA-256: `182d0c76ddce19d79c773ef30792eff36c3fab7cd647a0bf7c97aca674822812`.
- [OFF taxonomy documentation at that revision](https://github.com/openfoodfacts/openfoodfacts-server/blob/2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae/taxonomies/README.md) describes these files as core database structures containing translations and synonyms.
- [OFF's data-license documentation at that revision](https://github.com/openfoodfacts/openfoodfacts-server/blob/2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae/docs/api/tutorials/license-be-on-the-legal-side.md) specifies ODbL for the database, DbCL for individual contents, and CC BY-SA for product images. We use taxonomy data only. The repository's AGPL covers the server software; it is not substituted for the documented data licenses.
- [ODbL sections 4.2–4.4 and 4.6](https://opendatacommons.org/licenses/odbl/1-0/) require notices, attribution and public access to derived databases. [DbCL section 2](https://opendatacommons.org/licenses/dbcl/1-0/) grants content rights subject to ODbL compliance.

OFF's website/wiki returned access restrictions during verification; the publisher's pinned GitHub documentation supplied the evidence above. Applying the documented database terms to the ingredient taxonomy follows OFF's description of the taxonomy as database structure. These terms fit vegdex: the offline seed and generated tables stay in the public repository, and every emit publishes `dictionary.json` and `lookup/{en,it}.json` with provenance and license URLs. Catalog and full dataset files also retain those notices; the web footer credits OFF and links the public derived dictionary and ODbL. There is no need to use the approved Wikidata fallback.

## Reproduce offline

From the repository root:

```bash
pnpm seed:concepts
pnpm fixtures
```

Generation reads only `ingredients.off.txt` and `additions.json`. It verifies the pinned checksum and uses no network, model or API key. The output is deterministic: `concepts.json` and `ambiguous.json`. English and Italian aliases come from the same taxonomy entry; English singular spellings are added explicitly. Ambiguous aliases are omitted and reported (21 English, 7 Italian). Missing Italian names stay missing; English is still accepted on the Italian page.

The current seed contains 4,874 concepts with English names. `off:` identifiers are opaque hashes of frozen upstream entry identities, independent of the selected UI language. Existing IDs must be retained explicitly if a future seed changes an upstream identity; do not silently regenerate IDs from renamed labels. `veg:` IDs are assigned in committed additions. Additions can extend an existing concept's aliases by ID without changing its identity or parents.

`additions.json` contains three distinct concepts for vegan butter, plant milk and vegan parmesan. It also adds `funghi` to the mushroom entry (the pinned Italian taxonomy lists `fungo, fungi`) and cremini/crimini/baby bella aliases to brown mushroom. Romano and Ramiro peppers are added to sweet pepper, so "1 Romano or Ramiro pepper" is not read as Romano cheese. These are explicit seed entries; qualifying words are never removed to find a concept. Taxonomy parents support broad ingredient filters, so `funghi` also finds named mushroom varieties. Plant substitutes are never assigned an animal-product parent.

## Coverage

Every emit writes `concept-coverage.json`, counting mapped lines and listing each unmapped parsed name with its frequency. Unmapped English lines remain published; the existing text vegan check still applies.

`catalog-coverage.json` records a measurement of the public [English dataset](https://vegdex.antomanc.com/data/recipes.full.json), generated at `2026-10-28T21:28:57.399Z`: 16,030 recipes, 206,308 ingredient lines; 152,048 mapped (73.70%), 54,260 unmapped across 11,690 distinct names. Its checksum identifies the measured input; the URL changes as new catalog versions are deployed. Common gaps include all-purpose flour and baking soda, whose aliases are ambiguous or absent in this snapshot. No guessed aliases fill those gaps.

To measure another downloaded dataset without publishing or crawling:

```bash
pnpm --filter @vegdex/ingest exec tsx scripts/catalog-coverage.ts /path/to/recipes.full.json data/catalog-coverage.json
```

`pnpm test:e2e` regenerates the fixture dataset from `e2e/fixtures/store.json` before testing the production build. It includes chickpeas and pumpkin in a recipe whose title names neither, plus pumpkin and cremini mushrooms in another recipe, to exercise the emitted-data-to-UI search path.

## Published payloads and limits

`catalog.json` contains original titles, `contentLanguage: "en"`, legacy English ingredient names and concept IDs (including taxonomy ancestors). Detail shards contain original lines and their parsed quantity, unit, note and leaf concept. `recipes.full.json` carries those details plus the used English lookup for CLI/MCP. Original titles and ingredient lines still render; phase 3 supplies translated content.

The browser requests one language lookup after loading the catalog, containing only used concepts and their ancestors. It never imports the full seed. Italian lookups also accept English aliases; unknown names keep the existing text matching, and mapped English names can still match unmapped English ingredient text. Qualified unknown names get no concept fallback. Offline, an unvisited UI language can still browse the cached catalog using the cached English lookup (or the original text if no lookup is cached). Italian concept search is available offline after its lookup has been loaded online. Publication now checks mapped concepts alongside the original English ingredient text (#25). Grocery aggregation still uses the existing English names (#26).

The fixture store keeps lentil soup's yield unknown, matching the catalog fixture's existing serving-scaling tests. The full dataset and catalog now agree on that value; neither needs a hand-edited override after emission.

## Concept vegan check (#25)

Each generated concept has a `vegan` status: `yes`, `no`, `maybe` or `unknown`. Explicit `vegan:en` values come from the pinned taxonomy. Otherwise the status follows taxonomy parents; `no` takes priority over `maybe`, then `yes`. An explicit status overrides inheritance. Entries without evidence stay `unknown`. The three hand-seeded alternatives in `additions.json` explicitly say `yes` and have no animal parents. Regenerating the seed preserves concept IDs and aliases.

`findNonVeganConcepts` checks ingredient lines through the existing parser and returns the offending concept ID and original line for each mapped `no` status. As in the text check, a plant qualifier on the same option ("yogurt (i used soy yogurt)") excuses it. Emit combines those findings with `findNonVegan`; either check excludes the recipe. The existing exclusion report retains the recipe ID, title, URL and ingredient text, with a `concept` field on concept findings. The fixture's quark is a cheese concept inherited as `no`, although “quark” is absent from the English animal-word list.

Qualifiers stay with the ingredient and primary option they describe. Vegan butter cannot qualify quark or eggs elsewhere in the line or recipe. Preparation notes stay attached: a comma or semicolon starts a new ingredient only before a quantity, a mapped concept or a leading animal word, and "mac and cheese" or "bread and butter" stay one ingredient. Alternatives in parentheses cannot qualify the primary ingredient. As in the existing text check, secondary alternatives and note-only animal mentions are ignored. English ingredients that are unmapped or have `maybe`/`unknown` concept status continue through the text check; this dictionary does not certify them as vegan. All-vegan source restrictions and exclusion of translated editions still apply.
