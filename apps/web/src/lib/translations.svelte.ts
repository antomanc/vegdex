import { safeTranslation, type CatalogRecipe, type LanguageVocabulary } from '@vegdex/core'
import { loadOverlay } from './data'
import { pageLocale } from './i18n'

// Raw: the overlay holds thousands of titles and names; it is replaced whole, never edited.
class Display {
  overlay = $state.raw<LanguageVocabulary | null>(null)
  /** The overlay request has settled, with or without an overlay. */
  loaded = $state(false)
}
export const display = new Display()

export async function loadTranslations(): Promise<void> {
  display.overlay = await loadOverlay(pageLocale.code)
  display.loaded = true
}

/** The safety check runs once per title; search indexes titles per function, so new titles mean a new function. */
function titlesFrom(overlay: LanguageVocabulary | null): (recipe: CatalogRecipe) => string {
  const titles = new Map<string, string>()
  return (recipe) => {
    let title = titles.get(recipe.title)
    if (title === undefined) titles.set(recipe.title, (title = safeTranslation(recipe.title, overlay?.titles[recipe.title], pageLocale.code)))
    return title
  }
}
let current = { overlay: null as LanguageVocabulary | null, title: titlesFrom(null) }

/** Recipe titles in the page language, as one function per loaded overlay. Reading it tracks the overlay. */
export function recipeTitles(): (recipe: CatalogRecipe) => string {
  const overlay = display.overlay
  if (overlay !== current.overlay) current = { overlay, title: titlesFrom(overlay) }
  return current.title
}

export const recipeTitle = (recipe: CatalogRecipe): string => recipeTitles()(recipe)
