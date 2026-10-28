import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /<repo>/; set BASE_PATH there.
const base = process.env.BASE_PATH ?? '/'

// Preferred public origin. The canonical, Open Graph tags, JSON-LD, robots.txt and sitemap.xml all derive from it.
const siteUrl = 'https://vegdex.antomanc.com/'

const seo = (): Plugin => ({
  name: 'vegdex-seo',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%SITE_URL%', siteUrl) },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`
    })
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n  </url>\n</urlset>\n`
    })
  }
})

export default defineConfig({
  base,
  // Reachable over Tailscale as http://home-server:<port>.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['home-server', '.ts.net'] },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['home-server', '.ts.net'] },
  plugins: [
    svelte(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'vegdex: vegan recipes',
        short_name: 'vegdex',
        description: 'Find vegan recipes from all-vegan food blogs. Filter by ingredients, meal and cooking time, then visit the original creator for the recipe.',
        theme_color: '#1d4a31',
        background_color: '#eef0e9',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
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
