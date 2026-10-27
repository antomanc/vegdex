import type { FreeFrom, Meal } from '@vegdex/core'
import type { Sort } from './state.svelte'

export const MEAL_LABELS: [Meal, string][] = [
  ['breakfast', 'Breakfast'],
  ['main', 'Mains'],
  ['soup', 'Soups'],
  ['salad', 'Salads'],
  ['side', 'Sides'],
  ['snack', 'Snacks'],
  ['dessert', 'Desserts'],
  ['baking', 'Baking'],
  ['drink', 'Drinks'],
  ['sauce', 'Sauces & dips']
]
export const TIMES = [15, 30, 45, 60]
export const FREE: [FreeFrom, string][] = [
  ['gluten-free', 'Gluten-free'],
  ['nut-free', 'Nut-free'],
  ['soy-free', 'Soy-free'],
  ['oil-free', 'Oil-free']
]
export const SORTS: [Sort, string][] = [
  ['rating', 'Top rated'],
  ['newest', 'Newest'],
  ['fastest', 'Fastest'],
  ['relevance', 'Best match']
]

/** "25 min", "1 h 30 min", "9 h": long bakes read at a glance. */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact' })
export const formatCount = (n: number) => compact.format(n)
