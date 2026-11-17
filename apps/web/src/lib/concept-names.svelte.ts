import { BASE_LOCALE } from './locales'
import { loadLookup } from './data'
import { pageLocale } from './i18n'
import { display } from './translations.svelte'

// English names per concept, fetched the first time a fridge or a week needs one.
class Names {
  english = $state.raw<Map<string, string> | null>(null)
}
const names = new Names()
let asked = false

function load() {
  asked = true
  loadLookup(BASE_LOCALE.code).then(
    (file) => {
      const map = new Map<string, string>()
      // The shopping-list name when there is one, else the shortest name the concept goes by.
      for (const [name, concept] of Object.entries(file.aliases)) {
        const known = map.get(concept)
        if (known === undefined || name.length < known.length) map.set(concept, name)
      }
      for (const [concept, [name]] of Object.entries(file.grocery ?? {})) map.set(concept, name)
      names.english = map
    },
    () => {
      asked = false
    }
  )
}

/** An ingredient concept in the page language; empty until its name has arrived. Reading it tracks the arrival. */
export function conceptName(concept: string): string {
  if (!asked) load()
  const translated = pageLocale.code !== BASE_LOCALE.code ? display.overlay?.names[concept]?.one : undefined
  return translated ?? names.english?.get(concept) ?? ''
}
