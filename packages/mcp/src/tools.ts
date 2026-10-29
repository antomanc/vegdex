import {
  compileGroceryList,
  searchRecipes,
  type FullDataset,
  type FullRecipe,
  type GroceryItem,
  type RecipeQuery
} from '@vegdex/core'

export interface SearchArgs extends Omit<RecipeQuery, 'ids'> {
  limit?: number
}

function summary(data: FullDataset, r: FullRecipe) {
  const source = data.sources.find((s) => s.id === r.source)
  return {
    id: r.id,
    title: r.title,
    contentLanguage: r.contentLanguage ?? 'en',
    source: source?.name ?? r.source,
    url: r.url,
    minutes: r.minutes,
    servings: r.servings,
    rating: r.rating,
    ratingCount: r.ratingCount,
    caloriesPerServing: r.calories,
    proteinPerServing: r.protein,
    tags: r.tags,
    ingredientCount: r.ingredients.length,
    mainIngredients: r.ing.slice(0, 12)
  }
}

export function search(data: FullDataset, args: SearchArgs) {
  const { limit = 10, ...query } = args
  const all = searchRecipes(data.recipes, query, data.lookup)
  return {
    total: all.length,
    recipes: all.slice(0, Math.min(Math.max(limit, 1), 50)).map((r) => summary(data, r))
  }
}

export function getRecipes(data: FullDataset, ids: string[]) {
  const byId = new Map(data.recipes.map((r) => [r.id, r]))
  return ids.map((id) => {
    const r = byId.get(id)
    if (!r) return { id, error: 'unknown recipe id' }
    return { ...summary(data, r), ingredients: r.ingredients }
  })
}

export interface GroceryArgs {
  recipes: { id: string; servings?: number; multiplier?: number }[]
}

export function groceryList(data: FullDataset, args: GroceryArgs) {
  const byId = new Map(data.recipes.map((r) => [r.id, r]))
  const unknown = args.recipes.filter((x) => !byId.has(x.id)).map((x) => x.id)
  const inputs = args.recipes.flatMap((x) => {
    const r = byId.get(x.id)
    if (!r) return []
    const multiplier = x.multiplier ?? (x.servings && r.servings ? x.servings / r.servings : 1)
    return [{ recipeId: r.id, ingredients: r.ingredients, multiplier }]
  })
  const items = compileGroceryList(inputs, { lookup: data.lookup, concepts: data.grocery })
  const aisles: Record<string, { item: string; amount: string }[]> = {}
  for (const it of items) (aisles[it.aisle] ??= []).push({ item: it.name, amount: amountText(it) })
  return {
    recipes: inputs.map((i) => ({ id: i.recipeId, title: byId.get(i.recipeId)!.title, multiplier: round(i.multiplier) })),
    aisles,
    ...(unknown.length ? { unknownIds: unknown } : {}),
    note: 'Quantities are summed per ingredient across recipes, with synonyms merged; cups join grams only where the density is known (≈ marks an estimate). Lines without a quantity are listed as "to taste".'
  }
}

const round = (n: number) => Math.round(n * 100) / 100

function amountText(it: GroceryItem): string {
  return it.amounts.length ? it.amounts.join(' + ') : 'to taste'
}

export function sources(data: FullDataset) {
  const counts = new Map<string, number>()
  for (const r of data.recipes) counts.set(r.source, (counts.get(r.source) ?? 0) + 1)
  return {
    generatedAt: data.generatedAt,
    totalRecipes: data.recipes.length,
    sources: data.sources.map((s) => ({ ...s, recipes: counts.get(s.id) ?? 0 }))
  }
}
