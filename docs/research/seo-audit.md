# Vegdex SEO audit

Audited on 2026-10-28 for [issue #11](https://github.com/antomanc/vegdex/issues/11).

## Scope and decisions

Prioritize discovery searches about ingredients, meals, and cooking time. Success means helping a cook choose a recipe and visit its original publisher. Every source must remain all-vegan, and flagged recipes must remain unpublished. Do not copy recipe instructions or publisher prose to create SEO content.

Changes must require no additional spending. Keep static hosting and build artifacts; the owner's server is an available build option if needed. Language expansion gets a separate design session. URL and page-generation recommendations must accommodate future languages without adding speculative translations or locale routes now.

## Public responses before this change

These are HTTP observations, not evidence of Google's indexing or rankings. Requests used both a normal browser user agent and a Googlebot user-agent string; the latter does not reproduce Google's rendering or authenticated URL Inspection.

- The [homepage](https://vegdex.antomanc.com/) returned HTTP 200, an English document, one title and description, and an empty `<div id="app"></div>`. There was no canonical, Open Graph metadata, or JSON-LD. No `X-Robots-Tag` or HTML `noindex` directive was present.
- [`robots.txt`](https://vegdex.antomanc.com/robots.txt) and [`sitemap.xml`](https://vegdex.antomanc.com/sitemap.xml) returned HTTP 404. An absent robots.txt does not itself block crawling; the missing sitemap means there is no sitemap-based discovery signal.
- [`/?meal=main&max=30`](https://vegdex.antomanc.com/?meal=main&max=30) returned the same initial HTML shell. App filter and recipe state use query parameters, not generated documents.
- The illustrative collection path `/quick-vegan-dinners/` returned HTTP 404. It is not an existing landing page.
- HTTP requests to the homepage and requests to the [old GitHub Pages address](https://antomanc.github.io/vegdex/) redirected to the HTTPS custom-domain homepage. Keep `https://vegdex.antomanc.com/` as the preferred origin.
- The [public catalog](https://vegdex.antomanc.com/data/catalog.json) returned HTTP 200. Its snapshot was generated at `2026-10-28T09:57:42.163Z`, with 16,030 recipes from 24 publishers. The local generated catalog was older, so the opportunity counts below use the public snapshot.

## Repository findings

- [`index.html`](../../apps/web/index.html) is the shared entry document. [`main.ts`](../../apps/web/src/main.ts) mounts the Svelte app, and [`App.svelte`](../../apps/web/src/App.svelte) fetches the catalog in the browser. Searchable recipe content therefore depends on JavaScript rendering. Google supports rendering JavaScript, but some crawlers do not. [Google's rendering guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- [`RecipeCard.svelte`](../../apps/web/src/lib/RecipeCard.svelte) opens recipes with a button; [`RecipeSheet.svelte`](../../apps/web/src/lib/RecipeSheet.svelte) provides the outbound creator anchor inside a dialog. The card button is not a crawlable link. [Google's link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
- [`state.svelte.ts`](../../apps/web/src/lib/state.svelte.ts) reads query parameters and writes state with `history.replaceState`. Arbitrary combinations of search, sort, saved state, ingredients, and open dialogs should not become an automatically generated sitemap.
- [`daily.yml`](../../.github/workflows/daily.yml) emits the dataset, builds the site, and uploads `apps/web/dist` to GitHub Pages. Static collection generation could join that build without a runtime backend or hosting migration.
- [`vite.config.ts`](../../apps/web/vite.config.ts) uses a service-worker navigation fallback to the app entry. Future collection pages must remain available after a service worker controls the browser; test first visits and repeat visits so the fallback cannot replace a collection with the homepage.
- Language assumptions extend beyond labels: [`sitemap.ts`](../../packages/ingest/src/sitemap.ts) and [`emit.ts`](../../packages/ingest/src/emit.ts) exclude non-English URL paths; ingredient parsing, tagging, search, and the vegan check depend on English text. Removing the language exclusion alone would weaken the current publication checks.

## Implemented foundations

- Updated the homepage title and description to describe ingredient/time discovery and the visit to the creator. Added matching Open Graph metadata, including the 512px app icon as `og:image`, and a `summary` Twitter card. The PWA manifest description uses the same copy.
- Added the HTTPS homepage canonical in the original HTML. Current app-state URLs share this entry document and keep that canonical. This is an explicit preference for the homepage, not a guarantee Google will consolidate every filtered view. A future collection with materially different content must have its own canonical. [Google's canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- Added `WebSite` JSON-LD with the existing name, homepage URL, and current English language. Google documents this markup as a site-name preference. It does not create recipe rich results. [Google's site-name guidance](https://developers.google.com/search/docs/appearance/site-names).
- The preferred origin is defined once in [`vite.config.ts`](../../apps/web/vite.config.ts). A small build plugin fills it into `index.html` and emits `robots.txt` and `sitemap.xml`, so a domain change is a one-line edit.
- Added a permissive robots.txt advertising the sitemap. Catalog data, scripts, and styles remain crawlable so renderers can load the app.
- Added a sitemap (also emitted by that plugin; the service worker's navigation fallback skips both files) containing only the current canonical homepage. Omitted query variants, nonexistent collections, fake update dates, and unsupported language alternatives. Sitemap omission does not prevent crawling or indexing of other URLs.
- Added E2E checks for the actual built crawl-discovery files, metadata in the initial response, and canonical consistency while filtering and opening a recipe.

These foundations do not resolve the JavaScript shell or create discovery landing pages. They require no new dependency, paid tool, build service, or runtime server.

## Discovery opportunities

The following are query hypotheses based on Vegdex's product and catalog coverage, not measured keyword volumes or competition scores. Public search-result sampling is insufficient to establish those. Search Console query evidence should guide later expansion when available.

Counts use the existing `searchRecipes` function in [`query.ts`](../../packages/core/src/query.ts) against the public snapshot above. Each combination is representable in the current app. Counts indicate catalog matches, not editorial review of every result's dinner suitability.

| Candidate search intent | Core query | Matches | Publishers |
| --- | --- | ---: | ---: |
| Vegan dinners in 30 minutes | `meals: ['main'], maxMinutes: 30` | 2,269 | 24 |
| Quick vegan chickpea dinners | `meals: ['main'], include: ['chickpea'], maxMinutes: 30` | 296 | 24 |
| Quick vegan tofu dinners | `meals: ['main'], include: ['tofu'], maxMinutes: 30` | 391 | 24 |
| High-protein vegan dinners in 30 minutes | `meals: ['main'], highProtein: true, maxMinutes: 30` | 295 | 23 |
| Vegan soups in 30 minutes | `meals: ['soup'], maxMinutes: 30` | 262 | 23 |

The strongest initial pilot is a general 30-minute dinner collection plus chickpea and tofu variants: their intent maps directly onto existing filters and there is ample catalog coverage. Show a bounded, useful selection with creator names, available cooking times, direct publisher links, and a working "browse all matches" link. Use original factual headings and short explanatory text, not rewritten publisher introductions. Review examples before choosing a page's recipe selection.

High-protein pages can follow, with the existing definition of at least 20 g protein per serving and clear treatment of missing nutrition. Avoid expanding allergy-related SEO claims beyond the app's current derived tags and source-check guidance.

## Prioritized follow-up work

1. **Establish the Search Console baseline (no code; owner access needed).** Verify or use the custom-domain property, submit the deployed sitemap, inspect the homepage's rendered content and Google-selected canonical, and review available non-branded queries. Record the starting impressions, clicks, and indexed pages. Search Console access was not available for this audit, so current indexing and traffic remain unknown. [URL Inspection](https://support.google.com/webmasters/answer/9012289), [Performance report](https://support.google.com/webmasters/answer/7576553).
2. **Build the three-page discovery pilot (moderate implementation).** Generate a finite set of static collection documents from the emitted catalog. Give each its own title, description, canonical, heading, recipe facts, and real anchors; add navigation from the app and add the documents to the sitemap. Make the app link apply the exact collection filters. Fail safely on missing/empty datasets, escape catalog text, and retain the existing publication gate. Verify HTML with JavaScript disabled, production-style direct URLs, custom-base assets, empty-result handling, and repeat visits under the service worker. This is the largest unresolved crawlability opportunity. [Rendering](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
3. **Evaluate the pilot before generating more pages (ongoing review).** Use impressions, query relevance, selected canonicals, and organic clicks to judge whether the pages help. Outbound creator visits remain the product success path; Search Console does not measure those. If direct attribution is needed, choose a separate free measurement approach with explicit privacy requirements. Do not add tracking by default or generate every filter combination. [Faceted navigation guidance](https://developers.google.com/crawling/docs/faceted-navigation).
4. **Review collection structured data after pages exist (small follow-up).** Generic collection/list markup must reflect visible content. External publisher URLs do not satisfy Google's same-domain summary-page requirements for a host carousel. Do not promise recipe carousels or add fabricated instructions, ratings, or authors. Recipe instructions are currently recommended rather than required by Google's Recipe guide, so their absence alone is not an eligibility verdict. [Recipe](https://developers.google.com/search/docs/appearance/structured-data/recipe), [carousel](https://developers.google.com/search/docs/appearance/structured-data/carousel).
5. **Design language expansion separately.** Decide target languages, source coverage, translation scope, and language-aware publication checks. Keep collection identity independent of English labels/slugs and let future templates take language explicitly. Use real language-specific URLs and reciprocal `hreflang` only when equivalent translated pages exist; do not publish empty translated shells or pick a locale URL convention in this audit. No paid translation dependency is assumed. [Multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

## Deployment and verification

The application changes are local until deployed through the existing Pages workflow. After deployment, recheck the homepage source, robots.txt and sitemap.xml on the custom domain, then inspect the page in Search Console. Local build/E2E checks establish artifact behavior, not Google's eventual indexing or rankings.

No server migration, translation rollout, paid service, analytics installation, or collection-page launch is included in this foundation change. See [the source research](seo-guidance.md) for the official guidance behind the recommendations.
