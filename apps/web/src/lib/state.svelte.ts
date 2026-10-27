import type { Flavor, FreeFrom, Meal, RecipeQuery } from '@vegdex/core'

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
  sort: null as Sort | null,
  saved: false
})

export function toQuery(savedIds: string[]): RecipeQuery {
  return {
    text: filters.text.trim() || undefined,
    meals: filters.meals,
    flavor: filters.flavor ?? undefined,
    maxMinutes: filters.maxMinutes ?? undefined,
    freeFrom: filters.freeFrom,
    highProtein: filters.highProtein,
    include: filters.include,
    exclude: filters.exclude,
    sort: filters.sort ?? undefined,
    ids: filters.saved ? savedIds : undefined
  }
}

export function activeCount(): number {
  return (
    filters.meals.length +
    (filters.flavor ? 1 : 0) +
    (filters.maxMinutes ? 1 : 0) +
    filters.freeFrom.length +
    (filters.highProtein ? 1 : 0) +
    filters.include.length +
    filters.exclude.length
  )
}

export function clearFilters() {
  Object.assign(filters, {
    meals: [],
    flavor: null,
    maxMinutes: null,
    freeFrom: [],
    highProtein: false,
    include: [],
    exclude: []
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
  filters.sort = (p.get('sort') as Sort | null) ?? null
  filters.saved = p.get('view') === 'saved'
  return p.get('r')
}

export function writeUrl(openId: string | null) {
  const p = new URLSearchParams()
  if (filters.text) p.set('q', filters.text)
  if (filters.meals.length) p.set('meal', filters.meals.join(','))
  if (filters.flavor) p.set('flavor', filters.flavor)
  if (filters.maxMinutes) p.set('max', String(filters.maxMinutes))
  if (filters.freeFrom.length) p.set('free', filters.freeFrom.join(','))
  if (filters.highProtein) p.set('protein', '1')
  if (filters.include.length) p.set('have', filters.include.join(','))
  if (filters.exclude.length) p.set('avoid', filters.exclude.join(','))
  if (filters.sort) p.set('sort', filters.sort)
  if (filters.saved) p.set('view', 'saved')
  if (openId) p.set('r', openId)
  const qs = p.toString()
  const url = location.pathname + (qs ? `?${qs}` : '')
  if (url !== location.pathname + location.search) history.replaceState(null, '', url)
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

export const saved = $state({ ids: loadSaved() })

export function toggleSaved(id: string) {
  saved.ids = saved.ids.includes(id) ? saved.ids.filter((x) => x !== id) : [id, ...saved.ids]
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved.ids))
}
