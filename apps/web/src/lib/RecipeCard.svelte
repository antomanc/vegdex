<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
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
        <span class="placeholder" aria-hidden="true">❦</span>
      {/if}
      {#if recipe.minutes}<span class="time">{recipe.minutes} min</span>{/if}
    </div>
    <h2>{recipe.title}</h2>
    <p class="meta">
      {sourceName}
      {#if recipe.rating && recipe.ratingCount}· ★ {recipe.rating.toFixed(1)}{/if}
    </p>
  </button>
  <button
    class="heart"
    class:on={isSaved}
    aria-pressed={isSaved}
    aria-label={isSaved ? `Unsave ${recipe.title}` : `Save ${recipe.title}`}
    onclick={() => toggleSaved(recipe.id)}>♥</button
  >
</article>
