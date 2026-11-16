/**
 * Asks again whenever what `ask` reads changes, and applies only the newest answer:
 * one that a newer question overtook is dropped. `ask` returns nothing to skip a round.
 */
export function latest<T>(ask: () => Promise<T> | null | undefined | void, apply: (answer: T) => void, failed: (e: Error) => void): void {
  let asked = 0
  $effect(() => {
    const id = ++asked
    const answer = ask()
    if (!answer) return
    answer.then((value) => {
      if (id === asked) apply(value)
    }, failed)
  })
}
