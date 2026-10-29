import { safeTranslation, type CatalogRecipe, type LanguageOverlay } from '@vegdex/core'
import { loadOverlay } from './data'
import { pageLocale } from './i18n'

export const display = $state<{ overlay: LanguageOverlay | null }>({ overlay: null })

export async function loadTranslations(): Promise<void> {
  display.overlay = await loadOverlay(pageLocale.code)
}

export function recipeTitle(recipe: CatalogRecipe): string {
  return safeTranslation(recipe.title, display.overlay?.titles[recipe.title], pageLocale.code)
}
