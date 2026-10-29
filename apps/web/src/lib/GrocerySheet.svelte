<script lang="ts">
  import { display, recipeTitle } from './translations.svelte'
  import { compileGroceryList, displayGroceryName, parseIngredient, type CatalogRecipe, type GroceryItem, type ParsedIngredient } from '@vegdex/core'
  import { loadDetails, loadLookup, type LookupFile } from './data'
  import { BASE_LOCALE } from './locales'
  import { m, countArgs, formatNumber, pageLocale } from './i18n'
  import { AISLE_LABELS, formatGroceryAmount } from './labels'
  import Icon from './Icon.svelte'
  import { sheet } from './sheet'
  import { amounts, prefs, saved, setAmount } from './state.svelte'
  import UnitsToggle from './UnitsToggle.svelte'

  let { recipes, onclose }: { recipes: CatalogRecipe[]; onclose: () => void } = $props()

  // Newest saved first, like the saved view.
  const rows = $derived([...recipes].sort((a, b) => saved.ids.indexOf(a.id) - saved.ids.indexOf(b.id)))
  const adjusted = $derived(recipes.filter((r) => steps(r) !== perBatch(r)).length)
  // Check-offs survive closing the sheet: the list is used aisle by aisle in the store.
  const CHECKED_KEY = 'vegdex:grocery-checked'
  let checked = $state<Record<string, boolean>>(loadChecked())
  const anyChecked = $derived(Object.values(checked).some(Boolean))

  function loadChecked(): Record<string, boolean> {
    try {
      const v = JSON.parse(localStorage.getItem(CHECKED_KEY) ?? '{}')
      return v && typeof v === 'object' ? v : {}
    } catch {
      return {}
    }
  }

  $effect(() => {
    localStorage.setItem(CHECKED_KEY, JSON.stringify(checked))
  })

  const lines = $derived(Promise.all(recipes.map(async (r) => ({ id: r.id, contentLanguage: r.contentLanguage, ...await loadDetails(r.id) }))))
  // English concept names keep rows and checked state stable across UI and content languages.
  // Without them (an older dataset) the list still merges by name.
  const english = loadLookup(BASE_LOCALE.code).catch((): LookupFile => ({ aliases: {} }))
  const ready = $derived(Promise.all([lines, english]))
  const options = (file: LookupFile) => ({ lookup: file.aliases, concepts: file.grocery })
  // Canned and fresh tomatoes are two rows with one name, in different aisles.
  const key = (item: GroceryItem) => `${item.aisle}/${item.name}`

  // A tick belongs to this list: items no longer on it lose theirs, so next week's olive oil isn't pre-ticked.
  // Ticks stored by name alone (before concepts), or under a row name that has since changed,
  // move to the row now holding that ingredient.
  $effect(() => {
    ready.then(([all, file]) => {
      // Without the English names the rows are not the real ones: keep every tick for later.
      if (!file.grocery && recipes.some((r) => r.concepts)) return
      const items = compileGroceryList(all.map((r) => ({ ...r, recipeId: r.id, multiplier: 1 })), options(file))
      const kept: Record<string, boolean> = {}
      for (const [k, on] of Object.entries(checked)) {
        if (!on) continue
        const slash = k.indexOf('/')
        const aisle = slash > 0 && k.slice(0, slash) in AISLE_LABELS ? k.slice(0, slash) : null
        const name = aisle ? k.slice(slash + 1) : k
        let found = items.filter((i) => i.name === name)
        if (!found.length) found = items.filter((i) => i.lines.some((line) => parseIngredient(line).name === name))
        if (aisle && found.some((i) => i.aisle === aisle)) found = found.filter((i) => i.aisle === aisle)
        if (new Set(found.map((i) => i.name)).size !== 1) continue
        for (const item of found) kept[key(item)] = true
      }
      if (JSON.stringify(kept) !== JSON.stringify(Object.fromEntries(Object.entries(checked).filter(([, on]) => on)))) checked = kept
    })
  })

  /** Steps in one batch: whole servings for a recipe with a yield, half batches for one without. */
  const perBatch = (r: CatalogRecipe) => r.servings || 2
  const MAX_BATCHES = 4

  /** The stored amount in steps, snapped to the grid: a recipe's yield can change between crawls. */
  function steps(r: CatalogRecipe, by = 0): number {
    return Math.min(Math.max(Math.round((amounts[r.id] ?? 1) * perBatch(r)) + by, 1), MAX_BATCHES * perBatch(r))
  }

  function amountLabel(r: CatalogRecipe): string {
    const n = steps(r)
    if (r.servings) return m.servings_count(countArgs(n))
    return `×${Math.floor(n / 2) ? formatNumber(Math.floor(n / 2)) : ''}${n % 2 ? '½' : ''}`
  }

  const nudge = (r: CatalogRecipe, by: number) => setAmount(r.id, steps(r, by) / perBatch(r))

  function compile(all: { id: string; ingredients: string[]; parsedIngredients?: ParsedIngredient[]; contentLanguage?: string }[], file: LookupFile): [string, GroceryItem[]][] {
    const byId = new Map(recipes.map((r) => [r.id, r]))
    const multiplier = (id: string) => {
      const r = byId.get(id)
      return r ? steps(r) / perBatch(r) : 1
    }
    const items = compileGroceryList(all.map((r) => ({ ...r, recipeId: r.id, multiplier: multiplier(r.id) })), { units: prefs.units, ...options(file) })
    const byAisle = new Map<string, GroceryItem[]>()
    for (const item of items) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item])
    // Checked items sink to the bottom of their aisle, so what's left to grab stays on top.
    return [...byAisle].map(([aisle, list]) => [aisle, [...list].sort((a, b) => Number(!!checked[key(a)]) - Number(!!checked[key(b)]))])
  }
</script>

<dialog use:sheet class="sheet grocery-sheet" {onclose} aria-labelledby="grocery-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <h2 id="grocery-title">{m.shopping_list()}</h2>
    <details class="amounts">
      <summary class="meta">{m.list_recipes(countArgs(recipes.length))}{adjusted ? m.adjusted_count(countArgs(adjusted)) : ''}</summary>
      <ul>
        {#each rows as r (r.id)}
          {@const n = steps(r)}
          <li>
            <span class="title">{recipeTitle(r)}</span>
            <span class="stepper">
              <button aria-disabled={n === 1} onclick={() => nudge(r, -1)} aria-label={m.fewer_servings({ title: recipeTitle(r) })}>−</button>
              <span class="value" aria-live="polite">{amountLabel(r)}</span>
              <button aria-disabled={n === MAX_BATCHES * perBatch(r)} onclick={() => nudge(r, 1)} aria-label={m.more_servings({ title: recipeTitle(r) })}>+</button>
            </span>
          </li>
        {/each}
      </ul>
    </details>
    <div class="row units-row">
      <span class="label">{m.units()}</span>
      <UnitsToggle />
      <button class="text-btn uncheck" disabled={!anyChecked} onclick={() => (checked = {})}>{m.uncheck()}</button>
    </div>
    {#await ready}
      <p class="muted">{m.loading_ingredients()}</p>
    {:then [all, file]}
      {#each compile(all, file) as [aisle, items] (aisle)}
        <h3 class="aisle">{AISLE_LABELS[aisle]?.() ?? m.aisle_other()}</h3>
        <ul class="grocery" data-testid="grocery-list">
          {#each items as item (item.name)}
            <li>
              <label class:done={checked[key(item)]}>
                <input type="checkbox" bind:checked={checked[key(item)]} />
                <span class="name">{displayGroceryName(item, pageLocale.code === BASE_LOCALE.code ? undefined : display.overlay?.ingredients, pageLocale.code)}</span>
                <span class="amount">{item.toTaste ? m.to_taste() : item.amounts.map(formatGroceryAmount).join(' + ')}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/each}
      <p class="muted small">{m.grocery_note()}</p>
    {:catch}
      <p class="muted">{m.grocery_error()}</p>
    {/await}
  </div>
</dialog>
