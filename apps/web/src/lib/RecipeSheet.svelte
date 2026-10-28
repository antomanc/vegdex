<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
  import { loadIngredients } from './data'
  import Icon from './Icon.svelte'
  import { formatMinutes, splitAmount } from './labels'
  import { sheet } from './sheet'
  import { saved, toggleSaved } from './state.svelte'

  let { recipe, sourceName, onclose }: { recipe: CatalogRecipe; sourceName: string; onclose: () => void } = $props()

  let broken = $state(false)
  const ingredients = $derived(loadIngredients(recipe.id))
  const isSaved = $derived(saved.ids.includes(recipe.id))

  const LABELS: Record<string, string> = {
    'free:gluten-free': 'Gluten-free',
    'free:nut-free': 'Nut-free',
    'free:soy-free': 'Soy-free',
    'free:oil-free': 'Oil-free',
    'high-protein': 'High protein'
  }
  const diet = $derived(recipe.tags.flatMap((t) => (LABELS[t] ? [LABELS[t]] : [])))
  const cuisines = $derived(
    recipe.tags.flatMap((t) => (t.startsWith('cuisine:') ? [t.slice(8).replace(/\b\w/g, (c) => c.toUpperCase())] : []))
  )
</script>

<dialog use:sheet class="sheet recipe-sheet" {onclose} aria-labelledby="sheet-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label="Close"><Icon name="close" size={20} /></button></div>
    <div class="recipe-head">
    {#if recipe.image && !broken}
      <img class="hero" src={recipe.image} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
    {/if}
    <h2 id="sheet-title">{recipe.title}</h2>
    <p class="kitchen">
      <span>From the kitchen of <span class="kitchen-name">{sourceName}</span></span>
      {#if recipe.rating && recipe.ratingCount}<span class="rating"><Icon name="star" size={13} filled /><span class="visually-hidden">Rated</span> {recipe.rating.toFixed(1)} <span class="muted">({recipe.ratingCount.toLocaleString()} ratings)</span></span>{/if}
    </p>
    <!-- The printed fields of a recipe card, under its red line. -->
    <dl class="card-fields">
      {#if recipe.minutes}<div><dt>Time</dt><dd>{formatMinutes(recipe.minutes)}</dd></div>{/if}
      {#if recipe.servings}<div><dt>Serves</dt><dd>{recipe.servings}</dd></div>{/if}
      {#if recipe.calories || recipe.protein}
        <div>
          <dt>Per serving</dt>
          <dd>
            {#if recipe.calories}{Math.round(recipe.calories)} kcal{/if}{#if recipe.calories && recipe.protein}<br />{/if}{#if recipe.protein}{Math.round(recipe.protein)} g protein{/if}
          </dd>
        </div>
      {/if}
    </dl>
    {#if diet.length || cuisines.length}
      <ul class="badges">
        {#each diet as b (b)}<li>{b}</li>{/each}
        {#each cuisines as b (b)}<li class="cuisine">{b}</li>{/each}
      </ul>
    {/if}
    </div>

    <div class="recipe-ingredients">
    <h3>Ingredients</h3>
    {#await ingredients}
      <p class="muted">Loading…</p>
    {:then lines}
      <ul class="ingredients" data-testid="ingredients">
        {#each lines.map(splitAmount) as [amount, rest], i (i)}<li>{#if amount}<span class="amount">{amount}</span>{' '}{/if}{rest}</li>{/each}
      </ul>
    {:catch}
      <p class="muted">Ingredients are unavailable offline. Open the recipe on {sourceName}.</p>
    {/await}
    <p class="muted small">Method, photos and tips are on {sourceName}. Visiting supports the creator.</p>
    </div>

    <div class="sheet-footer actions">
      <button class="save" class:on={isSaved} aria-pressed={isSaved} onclick={() => toggleSaved(recipe.id)}>
        <Icon name="heart" size={18} filled={isSaved} /> {isSaved ? 'Saved' : 'Save'}
      </button>
      <a class="cta" href={recipe.url} target="_blank" rel="noopener">
        <span>Cook it on {sourceName}&nbsp;<Icon name="external" size={16} /></span>
      </a>
    </div>
  </div>
</dialog>
