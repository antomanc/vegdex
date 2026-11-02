/// <reference lib="webworker" />
// Owns the catalog: parsing 9 MB of JSON, indexing it and searching it never block the page.
// The page sends what it asks for and gets back only what it shows.
import {
  prepareSearch, safeTranslation, searchRecipes, unpackCatalog,
  type CatalogRecipe, type IngredientLookup, type RecipeQuery, type Source
} from '@vegdex/core'

export type CatalogRequest =
  | { kind: 'catalog'; data: ArrayBuffer; lookup: IngredientLookup; language: string }
  | { kind: 'titles'; titles: Record<string, string> | null }
  | { kind: 'search'; query: RecipeQuery; limit: number; countIds?: string[] }
  | { kind: 'rows'; ids: string[] }
  | { kind: 'counts'; queries: RecipeQuery[] }

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
}

const DRAW_POOL = 120

let recipes: CatalogRecipe[] = []
let byId = new Map<string, CatalogRecipe>()
let lookup: IngredientLookup = {}
let language = 'en'
let overlayTitles: Record<string, string> | null = null
// Search indexes display titles per function, so new titles get a new function.
let title: ((r: CatalogRecipe) => string) | undefined
let last: { key: string; title: typeof title; found: CatalogRecipe[] } | null = null

function titlesFrom(titles: Record<string, string> | null): ((r: CatalogRecipe) => string) | undefined {
  if (!titles) return undefined
  const memo = new Map<string, string>()
  return (r) => {
    let shown = memo.get(r.title)
    if (shown === undefined) memo.set(r.title, (shown = safeTranslation(r.title, titles[r.title], language)))
    return shown
  }
}

function search(query: RecipeQuery): CatalogRecipe[] {
  const key = JSON.stringify(query)
  if (last?.key !== key || last.title !== title) last = { key, title, found: searchRecipes(recipes, query, lookup, title) }
  return last.found
}

function handle(request: CatalogRequest): unknown {
  switch (request.kind) {
    case 'catalog': {
      const catalog = unpackCatalog(JSON.parse(new TextDecoder().decode(request.data)))
      recipes = catalog.recipes
      byId = new Map(recipes.map((r) => [r.id, r]))
      // Ingredient names only add matches, and only for datasets with concepts.
      lookup = recipes.some((r) => r.concepts) ? request.lookup : {}
      language = request.language
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
      const found = search(request.query)
      const counted = request.countIds ? new Set(request.countIds) : null
      return {
        total: found.length,
        counted: counted ? found.filter((r) => counted.has(r.id)).length : found.length,
        blogs: new Set(found.map((r) => r.source)).size,
        recipes: found.slice(0, request.limit),
        top: found.slice(0, DRAW_POOL)
      } satisfies Found
    }
    case 'rows':
      return request.ids.flatMap((id) => byId.get(id) ?? [])
    case 'counts':
      return request.queries.map((q) => searchRecipes(recipes, q, lookup, title).length)
  }
}

self.onmessage = ({ data }: MessageEvent<{ id: number; request: CatalogRequest }>) => {
  try {
    self.postMessage({ id: data.id, result: handle(data.request) })
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error) })
  }
}
