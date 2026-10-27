<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
  import Icon from './Icon.svelte'
  import { formatCount, formatMinutes } from './labels'
  import { saved, toggleSaved } from './state.svelte'

  let { recipe, sourceName, onopen }: { recipe: CatalogRecipe; sourceName: string; onopen: () => void } = $props()
  let broken = $state(false)
  const isSaved = $derived(saved.ids.includes(recipe.id))
</script>

<article class="card" data-testid="recipe-card">
  <button class="card-open" onclick={onopen} aria-label="Open {recipe.title}">
    <div class="thumb">
      {#if recipe.image && !broken}
        <img src={recipe.image} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
      {:else}
        <svg class="placeholder" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 44c0-16 10-26 28-28-1 18-10 28-26 28h-2z" fill="currentColor" /></svg>
      {/if}
      {#if recipe.minutes}<span class="time">{formatMinutes(recipe.minutes)}</span>{/if}
    </div>
    <h2>{recipe.title}</h2>
    <p class="meta">
      <span class="source">{sourceName}</span>
      {#if recipe.rating && recipe.ratingCount}<span class="rating"><Icon name="star" size={12} filled /><span class="visually-hidden">Rated</span> {recipe.rating.toFixed(1)} <span class="count">({formatCount(recipe.ratingCount)})</span></span>{/if}
    </p>
  </button>
  <button
    class="heart"
    class:on={isSaved}
    aria-pressed={isSaved}
    aria-label={isSaved ? `Unsave ${recipe.title}` : `Save ${recipe.title}`}
    onclick={() => toggleSaved(recipe.id)}><Icon name="heart" size={18} filled={isSaved} /></button
  >
</article>
