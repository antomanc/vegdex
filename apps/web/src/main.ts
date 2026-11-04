import { mount } from 'svelte'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// On the first visit the data loads before the service worker takes over, so none of it is cached for offline use.
// Once the worker controls the page, fetch those files again through it; the browser's HTTP cache usually answers.
// The observer also sees requests that were still in flight when the worker took over.
if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const controlledFrom = performance.now()
    new PerformanceObserver((list) => {
      for (const { name, startTime } of list.getEntries()) {
        if (startTime < controlledFrom && new URL(name).pathname.startsWith(`${import.meta.env.BASE_URL}data/`)) fetch(name).catch(() => {})
      }
    }).observe({ type: 'resource', buffered: true })
  }, { once: true })
}

export default app
