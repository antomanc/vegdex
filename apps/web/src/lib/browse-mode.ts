/**
 * Which browse screen the cook is on: the whole catalog, one blog's shelf, or the saved list.
 * Search and filters narrow every screen; the saved view ignores the browse filters.
 * Saved is a layer over the shelf it was opened from, so leaving it returns to that shelf.
 */
export type BrowseMode = 'catalog' | 'shelf' | 'saved'

/** The fields that decide the screen. Filters and the search text narrow whichever screen is on. */
export interface BrowseState {
  saved: boolean
  from: string | null
}

export function browseMode(f: BrowseState): BrowseMode {
  if (f.saved) return 'saved'
  return f.from ? 'shelf' : 'catalog'
}

/** The logo: the whole box, with the cook's other filters kept. */
export function showCatalog(f: BrowseState): void {
  f.saved = false
  f.from = null
}

/** A source's name in the recipe sheet: that blog's shelf. */
export function showShelf(f: BrowseState, id: string): void {
  f.saved = false
  f.from = id
}

/** The saved toggle. Turning it off leaves the shelf underneath on screen again. */
export function showSaved(f: BrowseState, on: boolean): void {
  f.saved = on
}
