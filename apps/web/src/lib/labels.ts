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
