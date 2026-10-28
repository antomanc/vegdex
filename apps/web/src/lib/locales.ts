// Imported by vite.config.ts, so this file stays free of workspace imports.

/** A UI language. The build, the runtime and the SEO files all read this list; later languages only add an entry and a messages file. */
export interface Locale {
  /** Paraglide locale code; messages/<code>.json holds its words. */
  code: string
  /** URL path segment the language lives under; empty for the language served at the root. */
  prefix: string
  /** Locale handed to `Intl` formatters. */
  intl: string
  /** Units used until the cook picks a system. */
  units: 'us' | 'metric'
  hreflang: string
}

export const LOCALES: readonly Locale[] = [
  { code: 'en', prefix: '', intl: 'en', units: 'us', hreflang: 'en' },
  { code: 'it', prefix: 'it', intl: 'it-IT', units: 'metric', hreflang: 'it' }
]

/** The source language: every message exists here first. */
export const BASE_LOCALE = LOCALES[0]!
