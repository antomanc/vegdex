<script lang="ts">
  import { compileGroceryList, type CatalogRecipe, type GroceryItem } from '@vegdex/core'
  import { loadIngredients } from './data'

  let { recipes, onclose }: { recipes: CatalogRecipe[]; onclose: () => void } = $props()

  let dialog = $state<HTMLDialogElement>()
  let multiplier = $state(1)
  let checked = $state<Record<string, boolean>>({})

  const lines = $derived(Promise.all(recipes.map(async (r) => ({ id: r.id, lines: await loadIngredients(r.id) }))))

  function compile(all: { id: string; lines: string[] }[]): [string, GroceryItem[]][] {
    const items = compileGroceryList(all.map((r) => ({ recipeId: r.id, ingredients: r.lines, multiplier })))
    const byAisle = new Map<string, GroceryItem[]>()
    for (const item of items) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item])
    return [...byAisle]
  }

  $effect(() => {
    dialog?.showModal()
  })
</script>

<dialog bind:this={dialog} class="sheet" onclose={onclose} onclick={(e) => e.target === dialog && dialog?.close()} aria-labelledby="grocery-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={() => dialog?.close()} aria-label="Close">×</button></div>
    <h2 id="grocery-title">Shopping list</h2>
    <p class="meta">For {recipes.length} saved {recipes.length === 1 ? 'recipe' : 'recipes'}</p>
    <div class="row">
      <span class="label">Batch size</span>
      <div class="pills wrap">
        {#each [0.5, 1, 2, 3] as m (m)}
          <button class="pill outline" class:on={multiplier === m} aria-pressed={multiplier === m} onclick={() => (multiplier = m)}>×{m}</button>
        {/each}
      </div>
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
