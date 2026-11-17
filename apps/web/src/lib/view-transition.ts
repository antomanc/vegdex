/**
 * One View Transition at a time. Starting another while one runs logs a console error
 * ("Transition was skipped") and races sheet open/close — fall back to a plain update instead.
 */

function still() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

let busy = false

/** Run `update` inside a view transition when free; otherwise run it immediately. */
export function startVt(update: () => void | Promise<void>): ViewTransition | null {
  if (still() || !document.startViewTransition || busy) {
    void Promise.resolve(update())
    return null
  }
  busy = true
  try {
    const run = document.startViewTransition(update)
    void run.finished.finally(() => {
      busy = false
    })
    return run
  } catch {
    busy = false
    void Promise.resolve(update())
    return null
  }
}
