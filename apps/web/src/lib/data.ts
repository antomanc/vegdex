import { shardOf, type Catalog, type GroceryConcepts, type IngredientLookup, type LanguageOverlay, type ParsedIngredient } from '@vegdex/core'
import { BASE_LOCALE } from './locales'

const base = import.meta.env.BASE_URL

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${base}data/catalog.json`)
  if (!res.ok) throw new Error(`Could not load recipes (HTTP ${res.status})`)
  return res.json()
}

export interface LookupFile {
  aliases: IngredientLookup
  /** English only: the shopping-list name and aisle per concept. */
  grocery?: GroceryConcepts
}

/** Requested after the catalog; contains only names of concepts used in that catalog. */
export async function loadLookup(language: string): Promise<LookupFile> {
  try {
    const res = await fetch(`${base}data/lookup/${language}.json`)
    if (!res.ok) throw new Error(`Could not load ingredient names (HTTP ${res.status})`)
    return await res.json()
  } catch (error) {
    if (navigator.onLine) throw error
    // An unvisited UI language must still browse the cached English catalog offline.
    return language === BASE_LOCALE.code ? { aliases: {} } : loadLookup(BASE_LOCALE.code)
  }
}

export interface RecipeDetails {
  ingredients: string[]
  parsedIngredients?: ParsedIngredient[]
}

const shards = new Map<number, Promise<Record<string, string[] | RecipeDetails>>>()

/** Original lines and parsed ingredients for one recipe, from its detail shard. */
export async function loadDetails(id: string): Promise<RecipeDetails> {
  const n = shardOf(id)
  let shard = shards.get(n)
  if (!shard) {
    shard = fetch(`${base}data/details/${String(n).padStart(2, '0')}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    shard.catch(() => shards.delete(n))
    shards.set(n, shard)
  }
  const detail = (await shard)[id]
  return Array.isArray(detail) ? { ingredients: detail } : detail ?? { ingredients: [] }
}

/** Original lines remain available to the shopping-list compiler and older consumers. */
export async function loadIngredients(id: string): Promise<string[]> {
  return (await loadDetails(id)).ingredients
}

const stringMap = (value: unknown): value is Record<string, string> => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'string')

/** Display overlays are optional: older builds and offline visits retain original text. */
export async function loadOverlay(language: string): Promise<LanguageOverlay | null> {
  try {
    const res = await fetch(`${base}data/overlay/${language}.json`)
    if (!res.ok) return null
    const value = await res.json()
    if (value?.language !== language || !stringMap(value.titles)) return null
    const tables = value.ingredients
    const valid = tables && stringMap(tables.names) && stringMap(tables.notes) && tables.units && typeof tables.units === 'object'
      && !Array.isArray(tables.units) && Object.values(tables.units).every((unit) => Array.isArray(unit) && unit.length === 2 && unit.every((v) => typeof v === 'string'))
    return { ...value, ingredients: valid ? tables : undefined }
  } catch {
    return null
  }
}
