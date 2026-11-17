/**
 * An installed app on a phone is rarely started afresh: it waits in the background and comes back where it was,
 * so a new version would wait for the system to close it. When the cook comes back to the app, ask for a new
 * version; one that has taken over while this page ran the old code is loaded on the next return, never in
 * front of an open sheet. Filters, the open view and saved recipes live in the URL and storage, so they survive.
 */

/** Asking more often than this on every return would only cost the phone a request. */
const CHECK_EVERY = 30 * 60 * 1000

interface Deps {
  container: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener' | 'getRegistration'>
  doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'querySelector'>
  reload: () => void
  now: () => number
}

export function reloadIntoUpdates({ container, doc, reload, now }: Deps) {
  // No controller yet: the first worker is taking over, which is an install, not an update.
  if (!container.controller) return
  let updated = false
  let checked = now()
  container.addEventListener('controllerchange', () => (updated = true))
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return
    if (updated && !doc.querySelector('dialog[open]')) return reload()
    if (now() - checked < CHECK_EVERY) return
    checked = now()
    void container.getRegistration().then((registration) => registration?.update()).catch(() => {})
  })
}
