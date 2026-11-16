/**
 * Asks again whenever what `ask` reads changes, and reports only on the newest question:
 * an answer or a failure that a newer question overtook is dropped, and so is one that lands
 * after the component is gone. `ask` returns nothing to skip a round.
 */
export function latest<T>(ask: () => Promise<T> | null | undefined | void, apply: (answer: T) => void, failed: (e: Error) => void): void {
  let current = 0
  $effect(() => {
    const id = ++current
    const answer = ask()
    if (answer) {
      answer.then(
        (value) => {
          if (id === current) apply(value)
        },
        (e: Error) => {
          if (id === current) failed(e)
        }
      )
    }
    return () => {
      current++
    }
  })
}
