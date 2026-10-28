<script lang="ts">
  import { compileGroceryList, type CatalogRecipe, type GroceryItem } from '@vegdex/core'
  import { loadIngredients } from './data'
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

  const lines = $derived(Promise.all(recipes.map(async (r) => ({ id: r.id, lines: await loadIngredients(r.id) }))))

  // A tick belongs to this list: items no longer on it lose theirs, so next week's olive oil isn't pre-ticked.
  $effect(() => {
    lines.then((all) => {
      const names = new Set(compileGroceryList(all.map((r) => ({ recipeId: r.id, ingredients: r.lines, multiplier: 1 }))).map((i) => i.name))
      const kept = Object.fromEntries(Object.entries(checked).filter(([name, on]) => on && names.has(name)))
      if (Object.keys(kept).length !== Object.keys(checked).length) checked = kept
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
    if (r.servings) return `${n} ${n === 1 ? 'serving' : 'servings'}`
    return `×${Math.floor(n / 2) || ''}${n % 2 ? '½' : ''}`
  }

  const nudge = (r: CatalogRecipe, by: number) => setAmount(r.id, steps(r, by) / perBatch(r))

  function compile(all: { id: string; lines: string[] }[]): [string, GroceryItem[]][] {
    const byId = new Map(recipes.map((r) => [r.id, r]))
    const multiplier = (id: string) => {
      const r = byId.get(id)
      return r ? steps(r) / perBatch(r) : 1
    }
    const items = compileGroceryList(all.map((r) => ({ recipeId: r.id, ingredients: r.lines, multiplier: multiplier(r.id) })), { units: prefs.units })
    const byAisle = new Map<string, GroceryItem[]>()
    for (const item of items) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item])
    // Checked items sink to the bottom of their aisle, so what's left to grab stays on top.
    return [...byAisle].map(([aisle, list]) => [aisle, [...list].sort((a, b) => Number(!!checked[a.name]) - Number(!!checked[b.name]))])
  }
</script>

<dialog use:sheet class="sheet grocery-sheet" {onclose} aria-labelledby="grocery-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label="Close"><Icon name="close" size={20} /></button></div>
    <h2 id="grocery-title">Shopping list</h2>
    <details class="amounts">
      <summary class="meta">For {recipes.length} saved {recipes.length === 1 ? 'recipe' : 'recipes'}{adjusted ? ` · ${adjusted} adjusted` : ''}</summary>
      <ul>
        {#each rows as r (r.id)}
          {@const n = steps(r)}
          <li>
            <span class="title">{r.title}</span>
            <span class="stepper">
              <button aria-disabled={n === 1} onclick={() => nudge(r, -1)} aria-label="Fewer servings of {r.title}">−</button>
              <span class="value" aria-live="polite">{amountLabel(r)}</span>
              <button aria-disabled={n === MAX_BATCHES * perBatch(r)} onclick={() => nudge(r, 1)} aria-label="More servings of {r.title}">+</button>
            </span>
          </li>
        {/each}
      </ul>
    </details>
    <div class="row units-row">
      <span class="label">Units</span>
      <UnitsToggle />
      <button class="text-btn uncheck" disabled={!anyChecked} onclick={() => (checked = {})}>Uncheck all</button>
    </div>
    {#await lines}
      <p class="muted">Loading ingredients…</p>
    {:then all}
      {#each compile(all) as [aisle, items] (aisle)}
        <h3 class="aisle">{aisle}</h3>
        <ul class="grocery" data-testid="grocery-list">
          {#each items as item (item.name)}
            <li>
              <label class:done={checked[item.name]}>
                <input type="checkbox" bind:checked={checked[item.name]} />
                <span class="name">{item.name}</span>
                <span class="amount">{item.toTaste ? 'to taste' : item.amounts.join(' + ')}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/each}
      <p class="muted small">Amounts are added up automatically. Check the recipes for anything unusual.</p>
    {:catch}
      <p class="muted">Could not load ingredients. Are you offline?</p>
    {/await}
  </div>
</dialog>
