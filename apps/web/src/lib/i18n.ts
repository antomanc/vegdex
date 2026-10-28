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

export { m } from '../paraglide/messages.js'
