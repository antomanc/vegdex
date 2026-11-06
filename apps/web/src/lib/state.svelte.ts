import type { Flavor, FreeFrom, Meal, RecipeQuery, Units } from '@vegdex/core'
import { browseMode } from './browse-mode'
import { m, formatNumber, pageLocale } from './i18n'
import { FREE, MEAL_LABELS } from './labels'

export { browseMode, showCatalog, showSaved, showShelf } from './browse-mode'

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

/** Any browse filter is chosen: the page is no longer the default screen. */
function hasFilters(f: Filters): boolean {
  return activeCount(f) > 0
}

export function toQuery(savedIds: string[], f: Filters = filters): RecipeQuery {
  const mode = browseMode(f)
  // The saved view is a list the user built by hand: browse filters never hide its recipes.
  if (mode === 'saved') return { text: f.text.trim() || undefined, sort: f.sort ?? undefined, ids: savedIds, preferredContentLanguage: pageLocale.code }
  const sort = f.sort ?? (f.text.trim() ? 'relevance' : mode === 'shelf' ? 'rating' : 'picks')
  const filterQuery: Partial<RecipeQuery> = {}
  for (const spec of FILTERS) Object.assign(filterQuery, spec.query(f))
  return {
    ...filterQuery,
    text: f.text.trim() || undefined,
    preferredContentLanguage: pageLocale.code,
    sort,
    // Savoury leads only the default screen: a chosen filter says what the cook wants to see.
    savouryLead: sort === 'picks' && !f.text.trim() && !hasFilters(f)
  }
}

/** One removable filter: its chip label and the change that removes it. */
export interface ActiveFilter {
  label: string
  patch: Partial<Filters>
}

/** Source id → blog name, filled once the catalog loads. */
export const sourceNames = new Map<string, string>()

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])
const without = <T,>(items: T[], v: T) => items.filter((x) => x !== v)
const mealLabels = new Map(MEAL_LABELS)
const freeLabels = new Map(FREE)

/**
 * Every browse filter in one place: how it travels in the URL, how it counts, what removes it,
 * what it asks the catalog, and what clearing sets. Adding a filter means adding one entry here.
 */
interface BrowseFilter {
  /** The URL parameter, when it has one; Tonight sets other filters instead. */
  param?: string
  /** Where it sits in a shared URL, so links keep the order they always had as filters are added. */
  urlAt?: number
  /** Counted behind "More filters", not on the quick row. */
  more?: boolean
  /** Tonight already spells out this filter's chip. */
  hiddenByTonight?: boolean
  /** The chips that remove it, one per chosen value. */
  chips(f: Filters): ActiveFilter[]
  /** What clearing every filter sets for this one. */
  clear: Partial<Filters>
  /** How many active filters this one contributes. */
  count(f: Filters): number
  /** The search query fields it sets. */
  query(f: Filters): Partial<RecipeQuery>
  read?(p: URLSearchParams): Partial<Filters>
  write?(f: Filters, p: URLSearchParams): void
}

const FILTERS: BrowseFilter[] = [
  {
    param: 'from',
    urlAt: 80,
    count: (f) => (f.from ? 1 : 0),
    chips: (f) => (f.from ? [{ label: m.from_source({ source: sourceNames.get(f.from) ?? f.from }), patch: { from: null } }] : []),
    clear: { from: null },
    query: (f) => ({ sources: f.from ? [f.from] : undefined }),
    read: (p) => ({ from: p.get('from') }),
    write: (f, p) => { if (f.from) p.set('from', f.from) }
  },
  {
    // Not a filter of its own: the chip replaces the meal and time it sets, spelled out for phones.
    count: () => 0,
    chips: () => (isTonight() ? [{ label: m.tonight_chip(), patch: { meals: [], maxMinutes: null } }] : []),
    clear: {},
    query: () => ({})
  },
  {
    param: 'flavor',
    urlAt: 20,
    count: (f) => (f.flavor ? 1 : 0),
    chips: (f) => (f.flavor ? [{ label: f.flavor === 'sweet' ? m.sweet() : m.savory(), patch: { flavor: null } }] : []),
    clear: { flavor: null },
    query: (f) => ({ flavor: f.flavor ?? undefined }),
    read: (p) => ({ flavor: (p.get('flavor') as Flavor | null) ?? null }),
    write: (f, p) => { if (f.flavor) p.set('flavor', f.flavor) }
  },
  {
    param: 'meal',
    urlAt: 10,
    hiddenByTonight: true,
    count: (f) => f.meals.length,
    chips: (f) => f.meals.map((v) => ({ label: mealLabels.get(v) ?? v, patch: { meals: without(f.meals, v) } })),
    clear: { meals: [] },
    query: (f) => ({ meals: f.meals }),
    read: (p) => ({ meals: list(p.get('meal')) as Meal[] }),
    write: (f, p) => { if (f.meals.length) p.set('meal', f.meals.join(',')) }
  },
  {
    param: 'max',
    urlAt: 30,
    hiddenByTonight: true,
    count: (f) => (f.maxMinutes ? 1 : 0),
    chips: (f) => (f.maxMinutes ? [{ label: m.time_limit({ count: formatNumber(f.maxMinutes) }), patch: { maxMinutes: null } }] : []),
    clear: { maxMinutes: null },
    query: (f) => ({ maxMinutes: f.maxMinutes ?? undefined }),
    read: (p) => ({ maxMinutes: p.get('max') ? Number(p.get('max')) : null }),
    write: (f, p) => { if (f.maxMinutes) p.set('max', String(f.maxMinutes)) }
  },
  {
    param: 'protein',
    urlAt: 50,
    more: true,
    count: (f) => (f.highProtein ? 1 : 0),
    chips: (f) => (f.highProtein ? [{ label: m.high_protein(), patch: { highProtein: false } }] : []),
    clear: { highProtein: false },
    query: (f) => ({ highProtein: f.highProtein }),
    read: (p) => ({ highProtein: p.get('protein') === '1' }),
    write: (f, p) => { if (f.highProtein) p.set('protein', '1') }
  },
  {
    param: 'free',
    urlAt: 40,
    more: true,
    count: (f) => f.freeFrom.length,
    chips: (f) => f.freeFrom.map((v) => ({ label: freeLabels.get(v) ?? v, patch: { freeFrom: without(f.freeFrom, v) } })),
    clear: { freeFrom: [] },
    query: (f) => ({ freeFrom: f.freeFrom }),
    read: (p) => ({ freeFrom: list(p.get('free')) as FreeFrom[] }),
    write: (f, p) => { if (f.freeFrom.length) p.set('free', f.freeFrom.join(',')) }
  },
  {
    param: 'have',
    urlAt: 60,
    more: true,
    count: (f) => f.include.length,
    chips: (f) => f.include.map((v) => ({ label: m.with({ ingredient: v }), patch: { include: without(f.include, v) } })),
    clear: { include: [] },
    query: (f) => ({ include: f.include }),
    read: (p) => ({ include: list(p.get('have')) }),
    write: (f, p) => { if (f.include.length) p.set('have', f.include.join(',')) }
  },
  {
    param: 'avoid',
    urlAt: 70,
    more: true,
    count: (f) => f.exclude.length,
    chips: (f) => f.exclude.map((v) => ({ label: m.without({ ingredient: v }), patch: { exclude: without(f.exclude, v) } })),
    clear: { exclude: [] },
    query: (f) => ({ exclude: f.exclude }),
    read: (p) => ({ exclude: list(p.get('avoid')) }),
    write: (f, p) => { if (f.exclude.length) p.set('avoid', f.exclude.join(',')) }
  }
]

/** Links keep the parameter order they have always had. */
const URL_FILTERS = FILTERS.filter((spec) => spec.param).sort((a, b) => (a.urlAt ?? 0) - (b.urlAt ?? 0))

export function activeFilters(): ActiveFilter[] {
  const tonight = isTonight()
  return FILTERS.flatMap((spec) => (tonight && spec.hiddenByTonight ? [] : spec.chips(filters)))
}

export function removeFilter(f: ActiveFilter) {
  Object.assign(filters, f.patch)
}

export function activeCount(f: Filters = filters): number {
  return FILTERS.reduce((n, spec) => n + spec.count(f), 0)
}

/** No search, filter, saved view or chosen order: the page a shared link opens, and the one first.json can fill. */
export function isLanding(): boolean {
  return browseMode(filters) === 'catalog' && !filters.text.trim() && !filters.sort && activeCount() === 0
}

/** Filters that live behind "More filters" (the quick pills show their own state). */
export function moreCount(f: Filters = filters): number {
  return FILTERS.filter((spec) => spec.more).reduce((n, spec) => n + spec.count(f), 0)
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

/** Sort used when none is picked: best match while searching, a blog's shelf stays top rated, else Today's picks. */
export function defaultSort(): Sort {
  if (filters.text.trim()) return 'relevance'
  // The saved view and a blog's shelf keep the order they had: rating.
  if (browseMode(filters) !== 'catalog') return 'rating'
  return 'picks'
}

export function clearFilters() {
  for (const spec of FILTERS) Object.assign(filters, spec.clear)
}

export function readUrl() {
  const p = new URLSearchParams(location.search)
  for (const spec of FILTERS) {
    const patch = spec.read?.(p)
    if (patch) Object.assign(filters, patch)
  }
  filters.text = p.get('q') ?? ''
  filters.sort = (p.get('sort') as Sort | null) ?? null
  filters.saved = p.get('view') === 'saved'
  return { openId: p.get('r'), listOpen: filters.saved && p.get('list') === '1' }
}

export function writeUrl(openId: string | null, listOpen = false) {
  const p = new URLSearchParams()
  if (filters.text) p.set('q', filters.text)
  for (const spec of URL_FILTERS) spec.write?.(filters, p)
  if (filters.sort) p.set('sort', filters.sort)
  const mode = browseMode(filters)
  if (mode === 'saved') p.set('view', 'saved')
  if (mode === 'saved' && listOpen) p.set('list', '1')
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
  const inSaved = browseMode(filters) === 'saved'
  saved.ids = was ? saved.ids.filter((x) => x !== id) : [id, ...saved.ids]
  saved.unsaved = was && inSaved ? [...saved.unsaved, id] : saved.unsaved.filter((x) => x !== id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved.ids))
  // Only the saved view offers an undo; anywhere else an unsave is final straight away.
  if (was && !inSaved) forgetUnsavedAmounts()
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
