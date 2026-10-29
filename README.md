# vegdex

Vegan recipes from the best vegan food blogs in one fast, filterable app, plus an MCP server so AI
agents can plan meals from real, tested recipes instead of making them up.

Every recipe is vegan. All sources are vegan-only blogs, and a second check drops any recipe whose
ingredients name an animal product without a plant-based qualifier.

Running it costs nothing: there is no server and no database.

```
sitemaps of ~25 vegan blogs
        │  GitHub Actions, daily 03:17 UTC
        ▼
crawl new pages → Recipe JSON-LD → vegan check → tags
        │
        ▼
catalog.json + details/*.json + recipes.full.json
        │
        ├─► web app (GitHub Pages): filters in the browser, works offline
        └─► MCP server / CLI (npx): downloads recipes.full.json once a day
```

## What's stored, and what isn't

vegdex keeps facts only: title, ingredient lines, times, servings, rating, nutrition and the image
URL. It never stores the method or the blogger's writing. Every recipe links to its creator for
those, so readers still visit the blogs. Images load directly from the publisher.

The crawler identifies itself (`vegdex/0.1 (+repo URL)`), respects `robots.txt` and crawl-delay,
makes at most one request per second per site, and after the first backfill only fetches pages
that are new or changed. Sites that block it are dropped, not worked around.

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Types, ingredient parser, vegan check, tagger, search, grocery-list math, metric weights. Shared by everything. |
| `packages/ingest` | Crawler and dataset emitter. Sources are in `packages/ingest/sources.json`. |
| `apps/web` | Svelte 5 + Vite PWA. |
| `packages/mcp` | `@antomanc/vegdex`: MCP server and CLI. |
| `e2e` | Playwright tests against a fixed fixture dataset. |

## Commands

```bash
pnpm install
pnpm ingest run                 # crawl (incremental) + emit into apps/web/public/data
pnpm ingest crawl --sources noracooks --max-per-source 50
pnpm ingest emit                # re-tag and re-check stored recipes without crawling
pnpm dev                        # web app on http://0.0.0.0:5173
pnpm test                       # unit + MCP integration tests (Vitest)
pnpm test:e2e                   # Playwright, mobile + desktop
pnpm fixtures                   # rebuild e2e/fixtures/data after changing the fixture store
pnpm ingest weights             # snapshot cup-measured lines for the metric weight tests
```

The crawl state (`.data/store.json.gz`) is kept as a release asset named `data`, not in git.
Vegan-check rejections are written to `.data/excluded.json` for review.

## Manual enrichment

The nightly emit records missing recipe titles, ingredient mappings and preparation phrases in
`.data/translation-queue.json`. Learned entries live in `.data/enrichment.json`; committed tables
win when they conflict. The nightly workflow never calls a model.

Authenticate the GitHub CLI with permission to write release assets and dispatch Actions workflows,
then run against an OpenAI-compatible model server:

```bash
ENRICH_BASE_URL=http://127.0.0.1:8080/v1 ENRICH_MODEL=vegdex-enrich pnpm enrich
```

The command downloads the release assets, processes the queue, merges any work published while the
model ran, uploads learned entries followed by the remaining queue, and triggers deployment with
crawling disabled. `--repo owner/repo` selects the repository; the default is `GITHUB_REPOSITORY`
when set, otherwise `antomanc/vegdex`. Accepted results also stay in the local files, so retrying a
failed upload reuses them. If dispatch fails, the command reports that the data is saved and deployment
is pending; retrying triggers another deployment attempt without translating completed strings again.

With queue and learned files already available locally, run:

```bash
ENRICH_BASE_URL=http://127.0.0.1:8080/v1 ENRICH_MODEL=vegdex-enrich pnpm enrich --local
```

The endpoint must support nonstreaming chat completions. Set `ENRICH_API_KEY` in the environment
if it needs bearer authentication. `--queue <file>` and `--learned <file>` select other local files
in either mode. Relative paths resolve from the repository root, and absolute paths work unchanged;
`--help` lists the options. This local mode does not upload data or deploy the site.

Each accepted result is saved before its task leaves the queue. Interrupted runs reuse saved
results. The command reports accepted, reused and remaining counts, plus task IDs with fixed
failure reasons; rejected tasks remain available for another run. New concepts get a stable ID
and an unknown vegan status. A known animal-concept finding can exclude a recipe at the next emit.

The checks reject malformed responses, changed numbers, unsafe display text, unknown IDs and
obvious language mismatches. They cannot prove that a translation preserves meaning. Sizes and
alternatives that cannot be represented faithfully retain their original text; correct those
through the committed tables. No model has been evaluated on the owner's desktop yet.

## Desktop setup and evaluation

Run `bash scripts/setup-enrichment.sh` on the Omarchy desktop for guided Vulkan/model setup,
private endpoint configuration, evaluation and enrich. `--help` and `--check` are non-destructive.
The [desktop guide](docs/desktop-enrichment.md) covers reproducible `pnpm eval:enrichment` runs,
scoring limits and the hardware checks still needed before choosing a model.

## Metric weights

The web app's Metric switch turns cups, ounces and inches into grams and centimeters; spoons and
whole items stay as written. A blog's own grams win. Otherwise grams come from a table of grams per
cup in `packages/core/src/weights.ts`, built from USDA FoodData Central (SR Legacy, public domain)
and the King Arthur Baking ingredient weight chart. Those amounts show with `≈`. The tests in
`packages/core/test/weights.test.ts` check the table against the catalog: it must know 98% of
cup-measured lines and agree with the grams blogs wrote next to their cups. After a big crawl, run
`pnpm ingest weights` and rerun `pnpm test`.

## Adding a source

Add the blog to `packages/ingest/sources.json` only if every recipe on it is vegan. Run
`pnpm ingest crawl --sources <id> --max-per-source 30`, then `pnpm ingest emit`, and check the
result and `.data/excluded.json`.

Set `contentLanguage` to `it` for original Italian publishers; it defaults to `en`.
Each content language needs a tested language pack. Non-English recipes with unmapped
ingredients stay held in `.data/translation-queue.json` until an enrich run maps them.
Translated editions of existing publishers remain excluded. Cucinaverza's bounded source
verification is recorded in [the source notes](docs/research/italian-source-cucinaverza.md).

## MCP server

```json
{ "mcpServers": { "vegdex": { "command": "npx", "args": ["-y", "@antomanc/vegdex", "mcp"] } } }
```

Tools: `search_vegan_recipes`, `get_vegan_recipes`, `compile_grocery_list`, `list_vegan_sources`.
The same features are on the command line: `npx @antomanc/vegdex search curry --max 30 --have tofu`.
