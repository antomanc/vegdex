# Cucinaverza source verification

Checked 29 October 2026 for #39.

[Cucinaverza](https://cucinaverza.com/) describes its collection as "le mie ricette 100% vegetali". Cristiana says she cooks, tests and photographs the recipes herself. Its Italian collection and [author page](https://cucinaverza.com/chi-sono/) support an original Italian all-vegan publisher.

[Robots rules](https://cucinaverza.com/robots.txt) permit recipe paths and advertise the [sitemap index](https://cucinaverza.com/sitemap_index.xml). Its [post sitemap](https://cucinaverza.com/post-sitemap.xml) contained 238 URLs at review time. The existing crawler selects that child, checks robots, rate limits requests and discards pages without recipe data.

Two bounded recipe checks found Recipe JSON-LD supported by the existing extractor:

- [Beetroot and potato gnocchi](https://cucinaverza.com/piatti-unici/primi/gnocchi-di-barbabietola-e-patate-senza-uova/): 60 minutes, four servings, five ingredient lines. Its cooked beetroot and type 0 flour retain their distinctions in the concept tables and shopping list. Extra flour "as needed" remains in the preparation note alongside the measured 350 g.
- [Vegan chocolate fudge](https://cucinaverza.com/dolci-colazione/vegan-fudge-al-cioccolato-fondente/): 130 minutes, one container, eight ingredient lines. Its compound hazelnut-cream-and-salt line remains unmapped and the recipe stays held.

Committed fixtures contain factual metadata and ingredient lines, without method text. Tests cover extraction, publication, English display, original text, shopping amounts and the held recipe. This was not a complete backfill; new unmapped ingredients enter the existing enrich queue. Source configuration uses the normal nightly workflow.
