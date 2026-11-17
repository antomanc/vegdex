import { baseLocale, getLocale, isLocale, overwriteGetLocale } from '../paraglide/runtime.js'
import { BASE_LOCALE, LOCALES } from './locales'

// Each language is its own built page, so the language is whatever the page declares: no runtime switching.
overwriteGetLocale(() => (isLocale(document.documentElement.lang) ? document.documentElement.lang : baseLocale))

export const pageLocale = LOCALES.find((locale) => locale.code === getLocale()) ?? BASE_LOCALE
const number = new Intl.NumberFormat(pageLocale.intl)
const plurals = new Intl.PluralRules(pageLocale.intl)
export const formatNumber = (n: number) => number.format(n)
export const countArgs = (n: number) => ({ count: formatNumber(n), plural: plurals.select(n) })
const quantity = new Intl.NumberFormat(pageLocale.intl, { useGrouping: false, maximumFractionDigits: 10 })
/** Only generated quantities; original ingredient lines keep the source's notation. */
export const formatQuantity = (text: string) => text.replace(/\d+(?:\.\d+)?/g, (n) => quantity.format(Number(n)))
export const formatRating = (n: number) => n.toLocaleString(pageLocale.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Read before first paint by index.html, which opens the cook's chosen language at a page's bare address (ADR 0002). */
export const LANGUAGE_KEY = 'vegdex:language'
const SKIP_EARLY_KEY = 'vegdex:skip-early'

export function rememberLanguage(code: string) {
  try {
    localStorage.setItem(LANGUAGE_KEY, code)
    // The next page must not paint first.json: that flash looked like the wrong recipes.
    sessionStorage.setItem(SKIP_EARLY_KEY, '1')
  } catch {}
}

/** Once per load after a language switch: skip the early shelf until the catalog answers. */
export function takeSkipEarly(): boolean {
  try {
    if (sessionStorage.getItem(SKIP_EARLY_KEY) !== '1') return false
    sessionStorage.removeItem(SKIP_EARLY_KEY)
    return true
  } catch {
    return false
  }
}

export { m } from '../paraglide/messages.js'
