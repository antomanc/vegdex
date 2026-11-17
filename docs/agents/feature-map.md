# Feature map

What a cook sees, with the names to use for it and the code behind it. Web code is under `apps/web/src/`. Keep this in step with the UI: a new view, control or sheet gets a row in the same change.

## One page, three views

`App.svelte` is the whole page. Which view shows is `browseMode(filters)` in `lib/browse-mode.ts`; filters and the open recipe live in the URL (`lib/state.svelte.ts`).

| Name | What it is | How to reach it |
| --- | --- | --- |
| Catalog | The grid of every recipe, sorted by **Today's picks** unless the cook sorts or searches | Default; the logo returns here |
| Blog shelf | One blog's recipes with a link to the blog | "From the kitchen of <blog>" on a recipe sheet |
| Saved view | The cook's saved recipes, with the shopping list button; unsaving can be undone until leaving | Heart in the header |

The first page before the worker answers is **Today's picks** from `first.json` (`lib/data.ts`); the catalog is loaded, indexed and searched in a worker (`lib/catalog.worker.ts`, `lib/catalog-client.ts`, ADR 0007).

## Header and controls

| Name | What it does | Code |
| --- | --- | --- |
| Logo | Back to the catalog, keeping other filters | `App.svelte` `home()` |
| Night mode toggle | Follows the system until switched | `lib/theme.svelte.ts` |
| Search | Matches titles and ingredients; sorts by **Best match** while typed | `App.svelte` |
| Signs (flavor and meal pills) | Savory, Sweet and meals; **Tonight** is one tap to a weeknight main | `lib/FilterBar.svelte` |
| More filters | Time limit, high protein, free-from, **Must include** and **Avoid** ingredients with suggestions | `lib/FilterBar.svelte`, `lib/IngredientField.svelte` |
| Active filters | Chips for each filter, removable one by one, and Clear all | `lib/ActiveFilters.svelte` |
| Sort | Today's picks, Top rated, Newest, Fastest, Best match | `App.svelte`, `lib/labels.ts` |
| Empty result | Names the one filter (or the search) whose removal brings recipes back | `App.svelte` (`loosen`) |
| Dock | **Back to top**, icon-only **Shopping list** (when anything is saved), and **Pick for me** at the bottom | `App.svelte` |
| Stall tip | One-time hint under the filters for Tonight and Pick on the landing | `App.svelte` (`vegdex:stall-tip-dismissed`) |
| Language suggestion and header switch | Switch between English (root) and Italian (`/it/`), keeping filters and saved recipes: the EN/IT button in the header, and a one-time suggestion for Italian browsers | `App.svelte` (`.language-switch`), `lib/LanguageSuggestion.svelte`, `lib/i18n.ts`, ADR 0002 |
| Units toggle | US or Metric amounts | `lib/UnitsToggle.svelte` |

## Sheets

| Name | What it shows | Code |
| --- | --- | --- |
| Recipe sheet | Photo, facts (time, servings, rating, protein), ingredients in the page language with the originals one action away, servings scaling, Save, Share, **Another** after Pick for me, "Cook it on <blog>", report a problem | `lib/RecipeSheet.svelte`, `lib/RecipeCard.svelte` for the card |
| Shopping list | Saved recipes merged by aisle, per-recipe amounts, check-offs that belong to this list, share or copy | `lib/GrocerySheet.svelte`, `lib/grocery-text.ts`, `packages/core/src/grocery.ts` |

Back closes a sheet instead of leaving the app (`lib/sheet.ts`).

## Behind the page

| Name | Where |
| --- | --- |
| Ingredient parsing, concepts, translations | `packages/core/src/ingredients.ts`, `concepts.ts`; vocabulary in `packages/ingest/data/vocab/` (ADR 0003, 0005, 0006) |
| Vegan guarantee | `findNonVegan` in `packages/core/src/vegan.ts`; nothing it flags is published |
| Crawl and emit | `packages/ingest` (`pnpm ingest`), daily workflow |
| Offline | Service worker `sw.ts` |
| Creator-link analytics | `lib/analytics.ts` (GoatCounter, only when configured) |

The e2e specs in `e2e/` are named after these features; `e2e/browse.spec.ts`, `saved.spec.ts` and `italian.spec.ts` cover most of the page.
