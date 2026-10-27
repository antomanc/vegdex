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
| `packages/core` | Types, ingredient parser, vegan check, tagger, search, grocery-list math. Shared by everything. |
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
```

The crawl state (`.data/store.json.gz`) is kept as a release asset named `data`, not in git.
Vegan-check rejections are written to `.data/excluded.json` for review.

## Adding a source

Add the blog to `packages/ingest/sources.json` only if every recipe on it is vegan. Run
`pnpm ingest crawl --sources <id> --max-per-source 30`, then `pnpm ingest emit`, and check the
result and `.data/excluded.json`.

## MCP server

```json
{ "mcpServers": { "vegdex": { "command": "npx", "args": ["-y", "@antomanc/vegdex", "mcp"] } } }
```

Tools: `search_vegan_recipes`, `get_vegan_recipes`, `compile_grocery_list`, `list_vegan_sources`.
The same features are on the command line: `npx @antomanc/vegdex search curry --max 30 --have tofu`.
