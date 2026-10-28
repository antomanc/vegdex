import { baseLocale, isLocale, overwriteGetLocale } from '../paraglide/runtime.js'

// Each language is its own built page, so the language is whatever the page declares: no runtime switching.
overwriteGetLocale(() => (isLocale(document.documentElement.lang) ? document.documentElement.lang : baseLocale))

export { m } from '../paraglide/messages.js'
