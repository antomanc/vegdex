import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { BASE_LOCALE, LOCALES, type Locale } from './src/lib/locales.ts'

// GitHub Pages serves the site from /<repo>/; set BASE_PATH there.
const base = process.env.BASE_PATH ?? '/'

// Preferred public origin. The canonical, Open Graph tags, JSON-LD, robots.txt and sitemap.xml all derive from it.
const siteUrl = 'https://vegdex.antomanc.com/'

type Messages = Record<string, unknown> & { meta_title: string; meta_description: string }
const messages = (code: string): Messages => JSON.parse(readFileSync(`messages/${code}.json`, 'utf8'))

// Paraglide compiles from project.inlang, which lists the same languages as the registry.
const declared: string[] = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8')).locales
if (declared.join() !== LOCALES.map((l) => l.code).join()) {
  throw new Error(`project.inlang/settings.json locales (${declared}) must match src/lib/locales.ts`)
}

// Paraglide silently falls back to English. Require every language, including English, to have every key.
const translations = LOCALES.map((locale) => ({ code: locale.code, text: messages(locale.code) }))
const keys = new Set(translations.flatMap(({ text }) => Object.keys(text).filter((key) => key !== '$schema')))
for (const { code, text } of translations) {
  const missing = [...keys].filter((key) => !Object.hasOwn(text, key))
  if (missing.length) throw new Error(`messages/${code}.json is missing: ${missing.join(', ')}`)
}

const escapeHtml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const pageUrl = (locale: Locale) => new URL(locale.prefix ? `${locale.prefix}/` : '', siteUrl).href
const localePath = (locale: Locale) => `${base}${locale.prefix ? `${locale.prefix}/` : ''}`
const alternates = [...LOCALES.map((locale) => ({ language: locale.hreflang, url: pageUrl(locale) })),
  { language: 'x-default', url: pageUrl(BASE_LOCALE) }]

/** The page's own words: <html lang>, title, description and JSON-LD language. */
const localize = (html: string, locale: Locale) => {
  const text = messages(locale.code)
  return html
    .replaceAll('%LANG%', locale.code)
    .replaceAll('%PAGE_URL%', pageUrl(locale))
    .replaceAll('%OG_LOCALE%', locale.ogLocale)
    .replaceAll('%MANIFEST%', `${localePath(locale)}manifest.webmanifest`)
    .replaceAll('%ALTERNATES%', alternates.map(({ language, url }) => `<link rel="alternate" hreflang="${language}" href="${url}" />`).join('\n    '))
    .replaceAll('%TITLE%', escapeHtml(text.meta_title!))
    .replaceAll('%DESCRIPTION%', escapeHtml(text.meta_description!))
}

const seo = (): Plugin => ({
  name: 'vegdex-seo',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => {
      const withOrigin = html.replaceAll('%SITE_URL%', siteUrl)
      // Dev has one page; a build makes one per language (see generateBundle).
      return ctx.server ? localize(withOrigin, BASE_LOCALE) : withOrigin
    }
  },
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      // Each UI language is its own page, built from the same bundle: / for the base language, /<prefix>/ for the rest.
      const page = bundle['index.html']
      if (page?.type !== 'asset') throw new Error('index.html missing from the bundle')
      const template = String(page.source)
      for (const locale of LOCALES) {
        const source = localize(template, locale)
        if (locale === BASE_LOCALE) page.source = source
        else this.emitFile({ type: 'asset', fileName: `${locale.prefix}/index.html`, source })
        const text = messages(locale.code)
        this.emitFile({
          type: 'asset',
          fileName: `${locale.prefix ? `${locale.prefix}/` : ''}manifest.webmanifest`,
          source: JSON.stringify({
            name: text.meta_title,
            short_name: 'vegdex',
            description: text.meta_description,
            lang: locale.code,
            theme_color: '#1d4a31',
            background_color: '#eef0e9',
            display: 'standalone',
            start_url: localePath(locale),
            scope: localePath(locale),
            icons: [
              { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
              { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
              { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          })
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${LOCALES.map((locale) => `  <url>\n    <loc>${pageUrl(locale)}</loc>\n${alternates.map(({ language, url }) => `    <xhtml:link rel="alternate" hreflang="${language}" href="${url}" />`).join('\n')}\n  </url>`).join('\n')}\n</urlset>\n`
      })
    }
  }
})

export default defineConfig({
  base,
  // Reachable over Tailscale as http://home-server:<port>.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['home-server', '.ts.net'] },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['home-server', '.ts.net'] },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['baseLocale']
    }),
    svelte(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['data/**'],
        navigateFallbackDenylist: [/\/data\//, /\/(robots\.txt|sitemap\.xml)$/],
        runtimeCaching: [
          {
            // The dataset changes once a day: serve the cached copy, refresh in the background.
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'vegdex-data', expiration: { maxEntries: 80 } }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'vegdex-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
})
