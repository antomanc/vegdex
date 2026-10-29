import { shardOf, type Catalog, type GroceryConcepts, type IngredientLookup, type LanguageVocabulary, type ParsedIngredient } from '@vegdex/core'
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

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value
const entries = <T>(value: unknown, valid: (v: unknown) => boolean): Record<string, T> =>
  record(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => valid(v))) as Record<string, T> : {}

/** Display vocabulary is optional: older builds and offline visits keep original text, and a malformed entry is dropped. */
export async function loadOverlay(language: string): Promise<LanguageVocabulary | null> {
  try {
    const res = await fetch(`${base}data/overlay/${language}.json`)
    if (!res.ok) return null
    const value = await res.json()
    if (value?.language !== language) return null
    return {
      language,
      titles: entries(value.titles, text),
      names: entries(value.names, (v) => record(v) && text(v.one) && text(v.other)),
      terms: entries(value.terms, (v) => text(v) || (record(v) && Object.values(v).every(text))),
      units: entries(value.units, (v) => Array.isArray(v) && v.length === 2 && v.every(text))
    }
  } catch {
    return null
  }
}
