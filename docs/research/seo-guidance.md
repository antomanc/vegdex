# SEO guidance for Vegdex

Sources checked on 2026-10-28 for [issue #11](https://github.com/antomanc/vegdex/issues/11). This note covers documented search-engine behavior. It does not establish Vegdex's current indexing, traffic, rankings, or keyword demand.

## Rendering and links

Google can render JavaScript, but app-shell content depends on that rendering step. Google also recommends server rendering or prerendering because it helps users and crawlers and some crawlers cannot execute JavaScript. Unique titles and descriptions should identify each page's purpose. [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Google normally discovers links through an `<a>` element with an `href`. A button that opens a dialog does not provide that link. JavaScript-enhanced anchors remain crawlable when their destinations resolve to real URLs. [Google: link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

For Vegdex, the practical first option is a small set of static discovery pages with recipe facts, publisher links, and links into the interactive app. Build them from the existing dataset. This is an architectural recommendation; the sources do not guarantee a ranking improvement from prerendering.

## Canonical URLs and filters

Canonical annotations signal a preferred URL among duplicate or very similar pages. Google prefers a clear canonical in the original HTML and advises against changing it to a different URL with JavaScript. Internal links should consistently use preferred URLs. A canonical is a signal, not an indexing command. [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Faceted navigation can create large spaces of filter combinations. Google documents different crawl controls depending on whether those combinations should be discoverable. Canonicals may reduce crawling over time but provide weaker crawl control than excluding unwanted facets. [Google: faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation).

For Vegdex, choose a finite set of useful collections with their own stable URLs. Keep transient search, sort, saved-list, and dialog state out of the sitemap. Choose canonical targets based on content equivalence; a materially different collection needs its own canonical. Avoid exposing every filter combination as an indexable landing page.

## Sitemaps and robots.txt

A sitemap should contain absolute URLs for the canonical pages intended to appear in search. Place it at the site root and keep it consistent with generated pages. Sitemap submission helps discovery but does not guarantee indexing or better rankings. [Google: build a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google: crawling and indexing FAQ](https://developers.google.com/search/help/crawling-index-faq).

`robots.txt` controls crawling. It does not reliably prevent a linked URL from appearing in search. A `noindex` rule needs the crawler to access the page, so blocking that page in robots.txt prevents Google from reading its rule. Leave resources needed to render the public app accessible. [Google: robots.txt introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [Google: noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Structured data

Markup must describe the visible page accurately. Valid syntax does not guarantee rich-result appearance. For a discovery collection, describe its collection purpose and the items visitors can actually see; do not invent instructions, reviews, or authorship. [Google: structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

The current Recipe guide lists `name` and `image` as required Recipe properties. `recipeInstructions` is recommended. Missing instructions alone therefore does not establish ineligibility. However, the guide describes Recipe markup for content about preparing a particular dish. Vegdex's publisher-first discovery model is a reason to defer Recipe markup until its fit with the actual page has been reviewed. [Google: Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe).

Google's host-carousel feature requires a supported content type alongside `ItemList`. Its summary-page item URLs must be distinct detail pages on the same domain. A list linking directly to recipes on different publishers' domains does not meet that summary-page requirement. Generic collection/list markup must not be presented as a promise of recipe-carousel eligibility. [Google: carousel structured data](https://developers.google.com/search/docs/appearance/structured-data/carousel).

## Future languages

Google recommends separate URLs for language versions instead of switching a single URL using cookies or browser preferences. Visible content determines the page language; setting `lang` or `hreflang` alone does not translate the content. [Google: multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

When equivalent language versions exist, `hreflang` annotations should include the page itself and its alternatives, use absolute URLs, and link reciprocally. Canonicals should normally point to a page in the same language. [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

For the collection pilot, keep collection identity separate from its English title and URL slug. Let the page template receive its language and text explicitly. Defer translated routes and `hreflang` until real language variants exist; decide the locale URL convention in the language-expansion session.

## Verification and cost boundary

Check generated HTML, HTTP responses, crawlable links, canonical consistency, and sitemap membership locally. Once deployed, use Search Console URL Inspection and its performance reports to establish indexing and query evidence. Public fetches and `site:` searches cannot substitute for an authenticated site's reports. [Google: URL Inspection](https://support.google.com/webmasters/answer/9012289), [Google: Performance report](https://support.google.com/webmasters/answer/7576553).

The proposed HTML, metadata, robots.txt, and sitemap changes can be static build artifacts. They require no paid SEO API, translation service, or runtime backend. Continue using the current hosting and build setup; the owner's server remains an option if build capacity becomes an issue. No recommendation here establishes future hosting quotas or guarantees search traffic.
