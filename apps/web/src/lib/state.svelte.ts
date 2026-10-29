import type { Flavor, FreeFrom, Meal, RecipeQuery, Units } from '@vegdex/core'
import { m, formatNumber, pageLocale } from './i18n'
import { FREE, MEAL_LABELS } from './labels'

export type Sort = NonNullable<RecipeQuery['sort']>

/** Filter state, mirrored into the URL so every view is shareable. */
export const filters = $state({
  text: '',
  meals: [] as Meal[],
  flavor: null as Flavor | null,
  maxMinutes: null as number | null,
  freeFrom: [] as FreeFrom[],
  highProtein: false,
  include: [] as string[],
  exclude: [] as string[],
  /** One blog's recipes only ("From the kitchen of …"): a source id. */
  from: null as string | null,
  sort: null as Sort | null,
  saved: false
})

export type Filters = typeof filters

export function toQuery(savedIds: string[], f: Filters = filters): RecipeQuery {
  // The saved view is a list the user built by hand: browse filters never hide its recipes.
  if (f.saved) return { text: f.text.trim() || undefined, sort: f.sort ?? undefined, ids: savedIds, preferredContentLanguage: pageLocale.code }
  return {
    text: f.text.trim() || undefined,
    preferredContentLanguage: pageLocale.code,
    meals: f.meals,
    flavor: f.flavor ?? undefined,
    maxMinutes: f.maxMinutes ?? undefined,
    freeFrom: f.freeFrom,
    highProtein: f.highProtein,
    include: f.include,
    exclude: f.exclude,
    sources: f.from ? [f.from] : undefined,
    sort: f.sort ?? undefined
  }
}

/** One removable filter: its chip label and the change that removes it. */
export interface ActiveFilter {
  label: string
  patch: Partial<Filters>
}

/** Source id → blog name, filled once the catalog loads. */
export const sourceNames = new Map<string, string>()

export function activeFilters(): ActiveFilter[] {
  const meal = new Map(MEAL_LABELS)
  const free = new Map(FREE)
  const without = <T,>(list: T[], v: T) => list.filter((x) => x !== v)
  const tonight = isTonight()
  return [
    ...(filters.from ? [{ label: m.from_source({ source: sourceNames.get(filters.from) ?? filters.from }), patch: { from: null } }] : []),
    ...(tonight ? [{ label: m.tonight(), patch: { meals: [], maxMinutes: null } }] : []),
    ...(filters.flavor ? [{ label: filters.flavor === 'sweet' ? m.sweet() : m.savory(), patch: { flavor: null } }] : []),
    ...(tonight ? [] : filters.meals.map((m) => ({ label: meal.get(m) ?? m, patch: { meals: without(filters.meals, m) } }))),
    ...(filters.maxMinutes && !tonight ? [{ label: m.time_limit({ count: formatNumber(filters.maxMinutes) }), patch: { maxMinutes: null } }] : []),
    ...(filters.highProtein ? [{ label: m.high_protein(), patch: { highProtein: false } }] : []),
    ...filters.freeFrom.map((f) => ({ label: free.get(f) ?? f, patch: { freeFrom: without(filters.freeFrom, f) } })),
    ...filters.include.map((v) => ({ label: m.with({ ingredient: v }), patch: { include: without(filters.include, v) } })),
    ...filters.exclude.map((v) => ({ label: m.without({ ingredient: v }), patch: { exclude: without(filters.exclude, v) } }))
  ]
}

export function removeFilter(f: ActiveFilter) {
  Object.assign(filters, f.patch)
}

export function activeCount(): number {
  return (
    filters.meals.length +
    (filters.flavor ? 1 : 0) +
    (filters.maxMinutes ? 1 : 0) +
    filters.freeFrom.length +
    (filters.highProtein ? 1 : 0) +
    filters.include.length +
    filters.exclude.length +
    (filters.from ? 1 : 0)
  )
}

/** Filters that live behind "More filters" (the quick pills show their own state). */
export function moreCount(): number {
  return filters.freeFrom.length + filters.include.length + filters.exclude.length
}

/** "Tonight": a weeknight main, on the table within 45 minutes. */
export const TONIGHT = { meal: 'main' as Meal, maxMinutes: 45 }

export function isTonight(): boolean {
  return filters.meals.length === 1 && filters.meals[0] === TONIGHT.meal && filters.maxMinutes === TONIGHT.maxMinutes
}

export function toggleTonight() {
  const on = isTonight()
  filters.meals = on ? [] : [TONIGHT.meal]
  filters.maxMinutes = on ? null : TONIGHT.maxMinutes
}

/** Sort used when none is picked: best match while searching, top rated otherwise. */
export function defaultSort(): Sort {
  return filters.text.trim() ? 'relevance' : 'rating'
}

export function clearFilters() {
  Object.assign(filters, {
    meals: [],
    flavor: null,
    maxMinutes: null,
    freeFrom: [],
    highProtein: false,
    include: [],
    exclude: [],
    from: null
  })
}

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export function readUrl() {
  const p = new URLSearchParams(location.search)
  filters.text = p.get('q') ?? ''
  filters.meals = list(p.get('meal')) as Meal[]
  filters.flavor = (p.get('flavor') as Flavor | null) ?? null
  filters.maxMinutes = p.get('max') ? Number(p.get('max')) : null
  filters.freeFrom = list(p.get('free')) as FreeFrom[]
  filters.highProtein = p.get('protein') === '1'
  filters.include = list(p.get('have'))
  filters.exclude = list(p.get('avoid'))
  filters.from = p.get('from')
  filters.sort = (p.get('sort') as Sort | null) ?? null
  filters.saved = p.get('view') === 'saved'
  return { openId: p.get('r'), listOpen: filters.saved && p.get('list') === '1' }
}

export function writeUrl(openId: string | null, listOpen = false) {
  const p = new URLSearchParams()
  if (filters.text) p.set('q', filters.text)
  if (filters.meals.length) p.set('meal', filters.meals.join(','))
  if (filters.flavor) p.set('flavor', filters.flavor)
  if (filters.maxMinutes) p.set('max', String(filters.maxMinutes))
  if (filters.freeFrom.length) p.set('free', filters.freeFrom.join(','))
  if (filters.highProtein) p.set('protein', '1')
  if (filters.include.length) p.set('have', filters.include.join(','))
  if (filters.exclude.length) p.set('avoid', filters.exclude.join(','))
  if (filters.from) p.set('from', filters.from)
  if (filters.sort) p.set('sort', filters.sort)
  if (filters.saved) p.set('view', 'saved')
  if (filters.saved && listOpen) p.set('list', '1')
  if (openId) p.set('r', openId)
  const qs = p.toString()
  const url = location.pathname + (qs ? `?${qs}` : '')
  if (url !== location.pathname + location.search) history.replaceState(history.state, '', url)
}

const SAVED_KEY = 'vegdex:saved'

function loadSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** `unsaved`: removed during this visit to the saved view, kept on screen so a mis-tap can be undone. */
export const saved = $state({ ids: loadSaved(), unsaved: [] as string[] })

export function toggleSaved(id: string) {
  const was = saved.ids.includes(id)
  saved.ids = was ? saved.ids.filter((x) => x !== id) : [id, ...saved.ids]
  saved.unsaved = was ? [...saved.unsaved, id] : saved.unsaved.filter((x) => x !== id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved.ids))
  // Only the saved view offers an undo; anywhere else an unsave is final straight away.
  if (was && !filters.saved) forgetUnsavedAmounts()
}

const AMOUNTS_KEY = 'vegdex:grocery-amounts'

function loadAmounts(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(AMOUNTS_KEY) ?? '{}')
    if (!v || typeof v !== 'object') return {}
    return Object.fromEntries(Object.entries(v).filter(([id, m]) => saved.ids.includes(id) && typeof m === 'number' && m > 0)) as Record<string, number>
  } catch {
    return {}
  }
}

/** How much of each saved recipe goes on the shopping list, as a multiplier; a recipe with no entry is ×1. */
export const amounts = $state<Record<string, number>>(loadAmounts())

export function setAmount(id: string, multiplier: number) {
  if (multiplier === 1) delete amounts[id]
  else amounts[id] = multiplier
  localStorage.setItem(AMOUNTS_KEY, JSON.stringify(amounts))
}

/** Unsaves are final: their amounts go too, so saving a recipe again starts at ×1. */
export function forgetUnsavedAmounts() {
  for (const id of Object.keys(amounts)) if (!saved.ids.includes(id)) delete amounts[id]
  localStorage.setItem(AMOUNTS_KEY, JSON.stringify(amounts))
}

const UNITS_KEY = 'vegdex:units'

/** US kitchens measure in cups; everyone else weighs. The page language can fix the default; an explicit choice sticks in every language. */
function loadUnits(): Units {
  const v = localStorage.getItem(UNITS_KEY)
  if (v === 'us' || v === 'metric') return v
  if (pageLocale.units !== 'region') return pageLocale.units
  return navigator.language === 'en-US' ? 'us' : 'metric'
}

/** One setting for the recipe sheet and the shopping list. */
export const prefs = $state({ units: loadUnits() })

export function setUnits(units: Units) {
  prefs.units = units
  localStorage.setItem(UNITS_KEY, units)
}
