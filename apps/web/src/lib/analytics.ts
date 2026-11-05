import { pageLocale } from './i18n'

/** GoatCounter's script sets window.goatcounter; a missing or blocked script leaves it undefined. */
type GoatCounter = {
  count?: (event: { path: string; title: string; event: boolean }) => void | Promise<void>
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

/**
 * One anonymous count per tap on the creator link: the blog and the UI language only.
 * Never the recipe, the person or how they reached it.
 */
export function countCook(source: string): void {
  try {
    window.goatcounter?.count?.({ path: `cook/${source}/${pageLocale.code}`, title: 'Cook it on the creator', event: true })
  } catch {
    // An ad blocker or a failed script must not keep the cook from the recipe.
  }
}
