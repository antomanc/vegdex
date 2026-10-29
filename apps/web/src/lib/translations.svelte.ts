import { safeTranslation, type CatalogRecipe, type LanguageVocabulary } from '@vegdex/core'
import { loadOverlay } from './data'
import { pageLocale } from './i18n'

export const display = $state<{ overlay: LanguageVocabulary | null }>({ overlay: null })

export async function loadTranslations(): Promise<void> {
  display.overlay = await loadOverlay(pageLocale.code)
}

export function recipeTitle(recipe: CatalogRecipe): string {
  return safeTranslation(recipe.title, display.overlay?.titles[recipe.title], pageLocale.code)
}
