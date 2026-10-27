import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /<repo>/; set BASE_PATH there.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  // Reachable over Tailscale as http://home-server:<port>.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['home-server', '.ts.net'] },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['home-server', '.ts.net'] },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'vegdex: vegan recipes',
        short_name: 'vegdex',
        description: 'Thousands of tested vegan recipes from the best vegan food blogs, filtered in a tap.',
        theme_color: '#1d4a31',
        background_color: '#f8f8f4',
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
        navigateFallbackDenylist: [/\/data\//],
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
