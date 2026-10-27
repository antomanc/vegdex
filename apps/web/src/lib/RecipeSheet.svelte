<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
  import { loadIngredients } from './data'
  import { saved, toggleSaved } from './state.svelte'

  let { recipe, sourceName, onclose }: { recipe: CatalogRecipe; sourceName: string; onclose: () => void } = $props()

  let dialog = $state<HTMLDialogElement>()
  const ingredients = $derived(loadIngredients(recipe.id))
  const isSaved = $derived(saved.ids.includes(recipe.id))

  const LABELS: Record<string, string> = {
    'free:gluten-free': 'Gluten-free',
    'free:nut-free': 'Nut-free',
    'free:soy-free': 'Soy-free',
    'free:oil-free': 'Oil-free',
    'high-protein': 'High protein'
  }
  const badges = $derived(
    recipe.tags.flatMap((t) => (LABELS[t] ? [LABELS[t]] : t.startsWith('cuisine:') ? [t.slice(8).replace(/\b\w/g, (c) => c.toUpperCase())] : []))
  )

  $effect(() => {
    dialog?.showModal()
  })
</script>

<dialog bind:this={dialog} class="sheet" onclose={onclose} onclick={(e) => e.target === dialog && dialog?.close()} aria-labelledby="sheet-title">
  <div class="sheet-body">
    <button class="close" onclick={() => dialog?.close()} aria-label="Close">×</button>
    {#if recipe.image}
      <img class="hero" src={recipe.image} alt="" referrerpolicy="no-referrer" />
    {/if}
    <h2 id="sheet-title">{recipe.title}</h2>
    <p class="meta">
      by {sourceName}
      {#if recipe.minutes}· {recipe.minutes} min{/if}
      {#if recipe.servings}· serves {recipe.servings}{/if}
      {#if recipe.rating && recipe.ratingCount}· ★ {recipe.rating.toFixed(1)} ({recipe.ratingCount}){/if}
    </p>
    {#if recipe.calories || recipe.protein}
      <p class="meta">
        {#if recipe.calories}{Math.round(recipe.calories)} kcal{/if}
        {#if recipe.calories && recipe.protein}·{/if}
        {#if recipe.protein}{Math.round(recipe.protein)} g protein{/if} per serving
      </p>
    {/if}
    {#if badges.length}
      <ul class="badges">
        {#each badges as b (b)}<li>{b}</li>{/each}
      </ul>
    {/if}

    <div class="actions">
      <a class="cta" href={recipe.url} target="_blank" rel="noopener">Cook it on {sourceName} ↗</a>
      <button class="save" class:on={isSaved} aria-pressed={isSaved} onclick={() => toggleSaved(recipe.id)}>
        {isSaved ? '♥ Saved' : '♡ Save'}
      </button>
    </div>

    <h3>Ingredients</h3>
    {#await ingredients}
      <p class="muted">Loading…</p>
    {:then lines}
      <ul class="ingredients" data-testid="ingredients">
        {#each lines as line, i (i)}<li>{line}</li>{/each}
      </ul>
    {:catch}
      <p class="muted">Ingredients are unavailable offline. Open the recipe on {sourceName}.</p>
    {/await}
    <p class="muted small">Method, photos and tips are on {sourceName}. Visiting supports the creator.</p>
  </div>
</dialog>
