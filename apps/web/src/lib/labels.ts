import { parseIngredient, metricLine, type FreeFrom, type Meal, type Units, type ParsedIngredient } from '@vegdex/core'
import { m, countArgs, formatNumber, formatQuantity, pageLocale } from './i18n'
import { BASE_LOCALE } from './locales'
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
const CUISINES: Record<string, () => string> = {
  'american': m.cuisine_american,
  'asian': m.cuisine_asian,
  'british': m.cuisine_british,
  'chinese': m.cuisine_chinese,
  'ethiopian': m.cuisine_ethiopian,
  'french': m.cuisine_french,
  'german': m.cuisine_german,
  'greek': m.cuisine_greek,
  'indian': m.cuisine_indian,
  'indonesian': m.cuisine_indonesian,
  'italian': m.cuisine_italian,
  'japanese': m.cuisine_japanese,
  'korean': m.cuisine_korean,
  'lebanese': m.cuisine_lebanese,
  'mediterranean': m.cuisine_mediterranean,
  'mexican': m.cuisine_mexican,
  'middle eastern': m.cuisine_middle_eastern,
  'moroccan': m.cuisine_moroccan,
  'spanish': m.cuisine_spanish,
  'thai': m.cuisine_thai,
  'turkish': m.cuisine_turkish,
  'vietnamese': m.cuisine_vietnamese
}
export const cuisineLabel = (name: string) => CUISINES[name]?.() ?? name.replace(/\b\w/g, (c) => c.toUpperCase())

export const AISLE_LABELS: Record<string, () => string> = {
  'produce': m.aisle_produce,
  'tofu & alternatives': m.aisle_tofu,
  'grains & pasta': m.aisle_grains,
  'beans & legumes': m.aisle_legumes,
  'canned & jarred': m.aisle_canned,
  'nuts & seeds': m.aisle_nuts,
  'oils, vinegars & sauces': m.aisle_oils,
  'spices': m.aisle_spices,
  'baking & sweeteners': m.aisle_baking,
  'plant milk & cream': m.aisle_plant_milk,
  'other': m.aisle_other
}

const UNIT_LABELS: Record<string, (args: ReturnType<typeof countArgs>) => string> = {
  'cup': m.unit_cup,
  'tbsp': m.unit_tbsp,
  'tsp': m.unit_tsp,
  'clove': m.unit_clove,
  'can': m.unit_can,
  'package': m.unit_package,
  'block': m.unit_block,
  'bunch': m.unit_bunch,
  'handful': m.unit_handful,
  'sprig': m.unit_sprig,
  'stalk': m.unit_stalk,
  'head': m.unit_head,
  'slice': m.unit_slice,
  'sheet': m.unit_sheet,
  'pinch': m.unit_pinch,
  'dash': m.unit_dash,
  'inch': m.unit_inch,
  'jar': m.unit_jar,
  'bag': m.unit_bag,
  'scoop': m.unit_scoop,
  'piece': m.unit_piece
}

/** Core returns English quantity strings for CLI/MCP; the web formats its own display. */
export function formatGroceryAmount(amount: string): string {
  const formatted = formatQuantity(amount)
  if (pageLocale.code === BASE_LOCALE.code) return formatted
  const parsed = parseIngredient(`${amount.replace(/^≈\s*/, '')} ingredient`)
  const label = UNIT_LABELS[parsed.unit ?? '']
  if (!label) return formatted
  return formatted.replace(/\b(?:cups?|tbsp|tsp|cloves?|cans?|packages?|blocks?|bunch(?:es)?|handfuls?|sprigs?|stalks?|heads?|slices?|sheets?|pinch(?:es)?|dash(?:es)?|inch(?:es)?|jars?|bags?|scoops?|pieces?)\b/, label(countArgs(parsed.quantity ?? 0)))
}

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
export function splitLine(line: string, units: Units, parsed?: ParsedIngredient): [string, string] {
  const metric = units === 'metric' ? metricLine(line, parsed) : null
  return metric ? [formatQuantity(metric[0]), tidyLine(metric[1])] : splitAmount(line)
}
