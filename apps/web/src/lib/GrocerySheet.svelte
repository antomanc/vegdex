<script lang="ts">
  import { compileGroceryList, type CatalogRecipe, type GroceryItem } from '@vegdex/core'
  import { loadIngredients } from './data'
  import Icon from './Icon.svelte'
  import { sheet } from './sheet'

  let { recipes, onclose }: { recipes: CatalogRecipe[]; onclose: () => void } = $props()

  let multiplier = $state(1)
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

  function compile(all: { id: string; lines: string[] }[]): [string, GroceryItem[]][] {
    const items = compileGroceryList(all.map((r) => ({ recipeId: r.id, ingredients: r.lines, multiplier })))
    const byAisle = new Map<string, GroceryItem[]>()
    for (const item of items) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item])
    // Checked items sink to the bottom of their aisle, so what's left to grab stays on top.
    return [...byAisle].map(([aisle, list]) => [aisle, [...list].sort((a, b) => Number(!!checked[a.name]) - Number(!!checked[b.name]))])
  }
</script>

<dialog use:sheet class="sheet" {onclose} aria-labelledby="grocery-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label="Close"><Icon name="close" size={20} /></button></div>
    <h2 id="grocery-title">Shopping list</h2>
    <p class="meta">For {recipes.length} saved {recipes.length === 1 ? 'recipe' : 'recipes'}</p>
    <div class="row">
      <span class="label">Scale all recipes</span>
      <div class="pills wrap">
        {#each [0.5, 1, 2, 3] as m (m)}
          <button class="pill outline" class:on={multiplier === m} aria-pressed={multiplier === m} onclick={() => (multiplier = m)}>×{m === 0.5 ? "½" : m}</button>
        {/each}
      </div>
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
