/** A flag that turns itself off `ms` after the last `show()`, such as a "Copied" confirmation. */
export function flash(ms: number) {
  let on = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    get on() {
      return on
    },
    show() {
      on = true
      clearTimeout(timer)
      timer = setTimeout(() => (on = false), ms)
    },
    hide() {
      clearTimeout(timer)
      on = false
    }
  }
}

/** `value()` once it has stopped changing for `ms`; `initial` until then. */
export function settled<T>(value: () => T, ms: number, initial: T) {
  let current = $state(initial)
  $effect(() => {
    const next = value()
    const timer = setTimeout(() => (current = next), ms)
    return () => clearTimeout(timer)
  })
  return {
    get current() {
      return current
    }
  }
}
