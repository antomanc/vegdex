import { metricLine, type FreeFrom, type Meal, type Units } from '@vegdex/core'
import { m, formatNumber, pageLocale } from './i18n'
import type { Sort } from './state.svelte'

export const MEAL_LABELS: [Meal, string][] = [
  ['breakfast', m.meal_breakfast()],
  ['main', m.meal_main()],
  ['soup', m.meal_soup()],
  ['salad', m.meal_salad()],
  ['side', m.meal_side()],
  ['snack', m.meal_snack()],
  ['dessert', m.meal_dessert()],
  ['baking', m.meal_baking()],
  ['drink', m.meal_drink()],
  ['sauce', m.meal_sauce()]
]
export const TIMES = [15, 30, 45, 60]
export const FREE: [FreeFrom, string][] = [
  ['gluten-free', m.free_gluten()],
  ['nut-free', m.free_nut()],
  ['soy-free', m.free_soy()],
  ['oil-free', m.free_oil()]
]
export const SORTS: [Sort, string][] = [
  ['rating', m.sort_rating()],
  ['newest', m.sort_newest()],
  ['fastest', m.sort_fastest()],
  ['relevance', m.sort_relevance()]
]

/** "25 min", "1 h 30 min", "9 h": long bakes read at a glance. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return m.minutes({ count: formatNumber(minutes) })
  const h = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? m.hours_minutes({ hours: formatNumber(h), minutes: formatNumber(rest) }) : m.hours({ count: formatNumber(h) })
}

const compact = new Intl.NumberFormat(pageLocale.intl, { notation: 'compact' })
export const formatCount = (n: number) => compact.format(n)

/** Publisher ingredient text, minus scraping leftovers: "((note))", "(, peeled)", stray asterisks. */
export function tidyLine(line: string): string {
  return line
    .replace(/\(\(/g, '(')
    .replace(/\)\)/g, ')')
    .replace(/\(\s*[,;]?\s*/g, '(')
    .replace(/,\s*\(/g, ' (')
    .replace(/\*+/g, '')
    .replace(/\s+([,)])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** "2½ cup vegetable broth" → ["2½", "cup vegetable broth"]: the amount is set in bold on the card. */
export function splitAmount(line: string): [string, string] {
  const tidy = tidyLine(line)
  const m = /^([\d½⅓⅔¼¾⅛⅜⅝⅞][\d½⅓⅔¼¾⅛⅜⅝⅞ ./,–-]{0,7}?)\s+(\D.*)$/.exec(tidy)
  return m ? [m[1]!, m[2]!] : ['', tidy]
}

/** splitAmount in the chosen units: metric rewrites cups, ounces and inches, and leaves spoons and whole items as written. */
export function splitLine(line: string, units: Units): [string, string] {
  const metric = units === 'metric' ? metricLine(line) : null
  return metric ? [metric[0], tidyLine(metric[1])] : splitAmount(line)
}
