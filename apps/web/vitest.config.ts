import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// Unit tests for the web app's runes code (*.svelte.test.ts), run by the root `pnpm test`.
export default defineConfig({
  plugins: [svelte()],
  // Svelte's server build never runs effects; tests need the client runtime.
  resolve: { conditions: ['browser'] },
  test: { name: 'web', include: ['src/**/*.test.ts'], environment: 'happy-dom' }
})
