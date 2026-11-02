# Filling the vocabulary

Ingredient lines render from `packages/ingest/data/vocab/` (see `docs/adr/0005`). The build measures what is missing; you fill it. Every worker uses the same loop: an agent session, a local model, an API.

```bash
pnpm coverage                                          # score per language, largest gaps
pnpm coverage --sample                                 # plus an example line per gap and the gap lines the top 10…250 of each kind cover
pnpm gaps --kind name --lang it --size 50 --batches 4  # .data/fill/it-name-001.json …
# answer each batch into .data/fill/it-name-001.answers.json
pnpm vocab:apply .data/fill/it-name-*.answers.json     # checks every answer, merges what passes
pnpm test packages/ingest/test/vocab.test.ts           # committed vocabulary stays clean
pnpm coverage                                          # see what moved
```

The first run downloads the crawl store from the `data` release with `gh`.

## How a name resolves

Before a phrase counts as a gap, the parser tries, in order: the name as written; the name without a plant qualifier ("vegan coconut yogurt"); the name with one typo fixed; and preparation terms or a product brand (`brands` in `vocab/en.json`) peeled off either end. A step never resolves to an animal word the original did not name. So a frequent gap is usually a missing alias, term or brand, cheaper to add than a fill.

Amounts are read before the name: dual and triple measures ("150 g / 1 cup / 5 oz"), a second measure without a slash ("1 cup 180g"), added amounts ("½ cup plus 2 tbsp"), ranges with their own unit, package sizes ("1 14.5 ounce (410 g) can"), containers (box, bottle, tub, batch, recipe…), "a few", "~" and labels naming one ingredient ("Spices: 1 tsp cumin"). An alternative with its own amount ("4 buns or 8 slices of bread") is commentary. Older answers learned names with some of these words still in them ("can crushed tomatoes"), so the name as written is tried too. A gap that still starts with a number or a unit is a parser bug: fix the parser, never answer it. Before committing a parser change, run `pnpm parse:diff <ref>` (usually `HEAD`): it parses every catalog line with both parsers against today's vocabulary, prints the changes by category with examples, and writes them all to `.data/scratch/parse-diff.tsv`. Read the `LOST` and `concept` examples before you commit.

## Gap kinds

| Kind | `--lang` is | Answer |
| --- | --- | --- |
| `map` | the language recipes are written in | `{"concept": "<id>"}`, `{"same": "<English name>"}`, `{"new": {"gloss": "...", "parents": [...]}}` or `"not-ingredient"` |
| `term` | the language recipes are written in | `{"term": "<id>"}`, `{"new": {"id": "term:...", "name": ...}}` or `"commentary"` |
| `name` | the display language | concept: `{"one", "other", "gender"}`; term: its forms |
| `title` | the display language | the translated title |

Each batch file carries its own `instructions`. Follow them exactly. The answers file is `{"kind", "language", "answers": {"<item id>": <answer>}}`. Leave out any item you are unsure of: an open gap shows the original text, while a wrong entry shows wrong text.

Work in this order: `map` and `term` first, because they decide what exists, then `name`, then `title`. Applying the same answers twice is safe: a `new` gloss vegdex already knows reuses that concept. A `"not-ingredient"` answer hides every line with that phrase.

## Answering batches as an agent

Split the batch files across cheap subagents (Haiku is enough; medium thinking for `map` and `name`, low for `term` and `title`), one or two files each. The batch carries every judgment rule, so the prompt only needs: the batch path, the answers path, "follow the instructions in the file, write only the answers file". Then run `pnpm vocab:apply` yourself and read the rejections. A rejection means the answer broke a check; never edit the checks to let it through.

## Unattended runs

`pnpm enrich --kind name --lang it --size 40 --batches 10` runs the same loop against any OpenAI-compatible endpoint (`ENRICH_BASE_URL`, `ENRICH_MODEL`, optional `ENRICH_API_KEY`), applying after each batch.

## Landing a fill

Commit `packages/ingest/data/vocab/` on a branch and open a PR with the `pnpm coverage` output before and after, plus the rejected count. Nobody reviews rows one by one; the checks, the animal-word list on every rendered line, and the vegan check at publish time are the safeguards.
