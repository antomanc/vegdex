<script lang="ts">
  import { recipeTitle } from './translations.svelte'
  import type { CatalogRecipe } from '@vegdex/core'
  import { m, countArgs, formatRating } from './i18n'
  import Icon from './Icon.svelte'
  import { formatCount, formatMinutes } from './labels'
  import { saved, toggleSaved } from './state.svelte'

  let { recipe, sourceName, onopen }: { recipe: CatalogRecipe; sourceName: string; onopen: () => void } = $props()
  let broken = $state(false)
  const isSaved = $derived(saved.ids.includes(recipe.id))
  const justUnsaved = $derived(saved.unsaved.includes(recipe.id))
  const id = $derived(`card-${recipe.id}`)
  const LOW_AVERAGE = 4.5
</script>

<article class="card" class:unsaved={justUnsaved} class:sweet={recipe.tags.includes('flavor:sweet')} data-testid="recipe-card">
  <button class="card-open" onclick={onopen} aria-labelledby="{id}-title" aria-describedby="{id}-meta">
    <div class="thumb">
      {#if recipe.image && !broken}
        <img src={recipe.image} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
      {:else}
        <svg class="placeholder" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 44c0-16 10-26 28-28-1 18-10 28-26 28h-2z" fill="currentColor" /></svg>
      {/if}
      {#if recipe.minutes}<span class="time">{formatMinutes(recipe.minutes)}</span>{/if}
    </div>
    <h2 id="{id}-title">{recipeTitle(recipe)}</h2>
    <p class="meta" id="{id}-meta">
      {#if recipe.minutes}<span class="visually-hidden">{formatMinutes(recipe.minutes)}, </span>{/if}
      <span class="source">{sourceName}</span>
      {#if recipe.rating && recipe.ratingCount}
        <!-- Most recipes average 5.0, so the card shows how many cooks rated it; a low average still shows. -->
        <span class="rating"><Icon name="star" size={12} filled />{' '}{#if recipe.rating < LOW_AVERAGE}{formatRating(recipe.rating)} · {/if}{m.rating_count({ ...countArgs(recipe.ratingCount), count: formatCount(recipe.ratingCount) })}<span class="visually-hidden">{m.average({ rating: formatRating(recipe.rating) })}</span></span>
      {/if}
    </p>
  </button>
  <button
    class="heart"
    class:on={isSaved}
    aria-pressed={isSaved}
    aria-label={isSaved ? m.unsave_recipe({ title: recipeTitle(recipe) }) : m.save_recipe({ title: recipeTitle(recipe) })}
    onclick={() => toggleSaved(recipe.id)}><Icon name="heart" size={18} filled={isSaved} /></button
  >
</article>
