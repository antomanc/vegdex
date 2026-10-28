/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { BASE_LOCALE, LOCALES } from './lib/locales'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const base = import.meta.env.BASE_URL
registerRoute(new NavigationRoute((options) => {
  const locale = LOCALES.find((locale) => locale.prefix && options.url.pathname.startsWith(`${base}${locale.prefix}/`)) ?? BASE_LOCALE
  return createHandlerBoundToURL(`${base}${locale.prefix ? `${locale.prefix}/` : ''}index.html`)(options)
}, { denylist: [/\/data\//, /\/(robots\.txt|sitemap\.xml)$/, /\.webmanifest$/] }))

// The dataset changes once a day: serve the cached copy, refresh in the background.
registerRoute(({ url }) => url.pathname.includes('/data/'), new StaleWhileRevalidate({
  cacheName: 'vegdex-data',
  plugins: [new ExpirationPlugin({ maxEntries: 80 })]
}))

registerRoute(({ request }) => request.destination === 'image', new CacheFirst({
  cacheName: 'vegdex-images',
  plugins: [
    new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    new CacheableResponsePlugin({ statuses: [0, 200] })
  ]
}))
