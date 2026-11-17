/// <reference lib="webworker" />
// Owns the catalog: parsing 9 MB of JSON, indexing it and searching it never block the page.
// The page sends what it asks for and gets back only what it shows.
import {
  cupboardOf, fridgeOrder, kitchenOf, lookupConcept, picksSeed, planWeek, prepareSearch, ratingScore, safeTranslation, searchRecipes, unpackCatalog, weekStats,
  type Catalog, type CatalogRecipe, type GroceryConcepts, type IngredientLookup, type Kitchen, type PackedCatalog, type RecipeQuery, type Source, type WeekStats
} from '@vegdex/core'

export type CatalogRequest =
  | { kind: 'catalog'; data: ArrayBuffer; lookup: IngredientLookup; language: string }
  | { kind: 'titles'; titles: Record<string, string> | null }
  | { kind: 'search'; query: RecipeQuery; limit: number; countIds?: string[] }
  | { kind: 'rows'; ids: string[] }
  | { kind: 'counts'; queries: RecipeQuery[] }
  | { kind: 'week'; query: RecipeQuery; count: number; slots: (string | null)[]; avoid: string[] }

export interface Loaded { sources: Source[]; generatedAt: string }

/** One page of a search: the rows to show and what the page says about the rest. */
export interface Found {
  total: number;
  /** Results among `countIds`, when given: the saved view counts what is still saved. */
  counted: number;
  blogs: number;
  recipes: CatalogRecipe[];
  /** The best matches, for "Pick for me": rows, so a drawn recipe opens at once. */
  top: CatalogRecipe[];
  /** Cooking from the fridge: what each shown recipe still needs, as concepts. */
  missing?: Record<string, string[]>;
}

/** A week of dinners and what it asks the shop for; concepts are named by the page. */
export interface Week { recipes: CatalogRecipe[]; stats: WeekStats }

const DRAW_POOL = 120

let recipes: CatalogRecipe[] = []
/** Which ingredient stands in for which; null for a catalog from before concept parents. */
let kitchen: Kitchen | null = null
let byId = new Map<string, CatalogRecipe>()
let lookup: IngredientLookup = {}
let language = 'en'
/** The catalog's emit day: seeds Today's picks, so the order changes with the daily dataset, not the device. */
let seed = ''
let overlayTitles: Record<string, string> | null = null
// Search indexes display titles per function, so new titles get a new function.
let title: ((r: CatalogRecipe) => string) | undefined
let last: { key: string; title: typeof title; found: CatalogRecipe[]; missing?: Map<string, string[]> } | null = null
/** Spices, oils and sauces leave the fridge and the week alone: stocked from the English names once one asks. */
let cupboard: Promise<void> | null = null
function stockCupboard(): Promise<void> {
  cupboard ??= fetch(`${import.meta.env.BASE_URL}data/lookup/en.json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((file: { aliases?: IngredientLookup; grocery?: GroceryConcepts } | null) => {
      if (!file?.aliases || !kitchen) return
      kitchen = { ...kitchen, cupboard: cupboardOf(file.aliases, file.grocery) }
      last = null
    })
    .catch(() => {
      // Without it the fridge still works, only stricter; the next question tries again.
      cupboard = null
    })
  return cupboard
}
const asksKitchen = (request: CatalogRequest) =>
  request.kind === 'week' || (request.kind === 'search' && !!request.query.fridge?.length) || (request.kind === 'counts' && request.queries.some((q) => q.fridge?.length))

/** The week planner draws from this many of the best matches. */
const WEEK_POOL = 240

function titlesFrom(titles: Record<string, string> | null): ((r: CatalogRecipe) => string) | undefined {
  if (!titles) return undefined
  const memo = new Map<string, string>()
  return (r) => {
    let shown = memo.get(r.title)
    if (shown === undefined) memo.set(r.title, (shown = safeTranslation(r.title, titles[r.title], language)))
    return shown
  }
}

/** Today's picks need the emit day; every other sort does not. */
function seeded(query: RecipeQuery): RecipeQuery {
  return query.sort === 'picks' ? { ...query, seed } : query
}

/** Every match, and with a fridge what each one still needs: fridge recipes come in fit order. */
function find(query: RecipeQuery): { found: CatalogRecipe[]; missing?: Map<string, string[]> } {
  const { fridge, ...rest } = query
  if (!fridge?.length || !kitchen) return { found: searchRecipes(recipes, rest, lookup, title) }
  const have = new Set(fridge.flatMap((name) => lookupConcept(name, lookup) ?? []))
  // Fit decides the order; the best rated come first among equal fits.
  const fits = fridgeOrder(searchRecipes(recipes, { ...rest, sort: 'rating', seed: undefined, savouryLead: undefined }, lookup, title), have, kitchen, (r) => r.concepts ?? [])
  return { found: fits.map((f) => f.recipe), missing: new Map(fits.map((f) => [f.recipe.id, f.missing])) }
}

function search(query: RecipeQuery): NonNullable<typeof last> {
  const key = JSON.stringify(query)
  if (last?.key !== key || last.title !== title) last = { key, title, ...find(query) }
  return last
}

/** The best rated rows, page language first on ties: the pool "Pick for me" draws from. */
function rankedByRating(rows: CatalogRecipe[], preferred = ''): CatalogRecipe[] {
  return [...rows].sort((a, b) =>
    ratingScore(b) - ratingScore(a) ||
    Number((b.contentLanguage ?? 'en') === preferred) - Number((a.contentLanguage ?? 'en') === preferred))
}

function handle(request: CatalogRequest): unknown {
  switch (request.kind) {
    case 'catalog': {
      const packed: Catalog | PackedCatalog = JSON.parse(new TextDecoder().decode(request.data))
      const catalog = unpackCatalog(packed)
      recipes = catalog.recipes
      byId = new Map(recipes.map((r) => [r.id, r]))
      // Ingredient names only add matches, and only for datasets with concepts.
      lookup = recipes.some((r) => r.concepts) ? request.lookup : {}
      language = request.language
      kitchen = packed.version === 2 ? kitchenOf(packed.concepts, packed.parents, lookup) : null
      cupboard = null
      seed = picksSeed(catalog.generatedAt)
      title = titlesFrom(overlayTitles)
      last = null
      prepareSearch(recipes)
      return { sources: catalog.sources, generatedAt: catalog.generatedAt } satisfies Loaded
    }
    case 'titles':
      overlayTitles = request.titles
      title = titlesFrom(overlayTitles)
      return null
    case 'search': {
      const { found, missing } = search(seeded(request.query))
      const counted = request.countIds ? new Set(request.countIds) : null
      // "Pick for me" draws from the best rated matches whatever the visible order: a daily pick must not
      // change the draw. Today's picks already reordered `found`, so rank a copy back by rating.
      const best = request.query.sort === 'picks' && !missing ? rankedByRating(found, request.query.preferredContentLanguage) : found
      const shown = found.slice(0, request.limit)
      return {
        total: found.length,
        counted: counted ? found.filter((r) => counted.has(r.id)).length : found.length,
        blogs: new Set(found.map((r) => r.source)).size,
        recipes: shown,
        top: best.slice(0, DRAW_POOL),
        ...(missing ? { missing: Object.fromEntries(shown.map((r) => [r.id, missing.get(r.id) ?? []])) } : {})
      } satisfies Found
    }
    case 'rows':
      return request.ids.flatMap((id) => byId.get(id) ?? [])
    case 'counts':
      // A count does not depend on the order: skip Today's picks (and its mix) so counting stays cheap.
      return request.queries.map((q) => find({ ...q, sort: undefined, savouryLead: undefined }).found.length)
    case 'week': {
      if (!kitchen) return { recipes: [], stats: { items: 0, separate: 0, shared: [] } } satisfies Week
      // A dinner is a dish: a dressing or a drink tagged main stays out unless the cook chose that course.
      const asked = new Set(request.query.meals ?? [])
      const dish = (r: CatalogRecipe) => !(['sauce', 'drink'] as const).some((m) => !asked.has(m) && r.tags.includes(`meal:${m}`))
      const pool = find({ ...request.query, sort: 'rating', seed: undefined, savouryLead: undefined }).found.filter(dish).slice(0, WEEK_POOL)
      const conceptsOf = (r: CatalogRecipe) => r.concepts ?? []
      const week = planWeek(pool, conceptsOf, kitchen, { count: request.count, slots: request.slots, avoid: new Set(request.avoid) })
      return { recipes: week, stats: weekStats(week.map(conceptsOf), kitchen) } satisfies Week
    }
  }
}

self.onmessage = ({ data }: MessageEvent<{ id: number; request: CatalogRequest }>) => {
  const answer = (result: unknown) => self.postMessage({ id: data.id, result })
  const fail = (error: unknown) => self.postMessage({ id: data.id, error: String(error) })
  try {
    // The fridge and the week wait for the cupboard; everything else answers at once.
    if (kitchen && !kitchen.cupboard.size && asksKitchen(data.request)) void stockCupboard().then(() => answer(handle(data.request))).catch(fail)
    else answer(handle(data.request))
  } catch (error) {
    fail(error)
  }
}
