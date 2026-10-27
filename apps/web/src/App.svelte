<script lang="ts">
  import { searchRecipes, type Catalog, type CatalogRecipe } from '@vegdex/core'
  import { loadCatalog } from './lib/data'
  import { activeCount, clearFilters, filters, readUrl, saved, toQuery, writeUrl } from './lib/state.svelte'
  import FilterBar from './lib/FilterBar.svelte'
  import ActiveFilters from './lib/ActiveFilters.svelte'
  import Icon from './lib/Icon.svelte'
  import RecipeCard from './lib/RecipeCard.svelte'
  import RecipeSheet from './lib/RecipeSheet.svelte'
  import GrocerySheet from './lib/GrocerySheet.svelte'

  const PAGE = 48

  let catalog = $state<Catalog | null>(null)
  let error = $state<string | null>(null)
  let openId = $state<string | null>(readUrl())
  let groceryOpen = $state(false)
  let limit = $state(PAGE)
  let sentinel = $state<HTMLElement>()

  function load() {
    error = null
    loadCatalog()
      .then((c) => (catalog = c))
      .catch((e: Error) => {
        console.error(e)
        error = "Couldn't load the recipes. Check your connection and try again."
      })
  }
  load()

  const sourceNames = $derived(new Map(catalog?.sources.map((s) => [s.id, s.name]) ?? []))
  const results = $derived<CatalogRecipe[]>(catalog ? searchRecipes(catalog.recipes, toQuery(saved.ids)) : [])
  const visible = $derived(results.slice(0, limit))
  const open = $derived(openId && catalog ? catalog.recipes.find((r) => r.id === openId) ?? null : null)
  const savedRecipes = $derived(catalog ? catalog.recipes.filter((r) => saved.ids.includes(r.id)) : [])

  // New filters start from the top of the list.
  $effect(() => {
    toQuery(saved.ids)
    limit = PAGE
  })

  $effect(() => writeUrl(openId))

  $effect(() => {
    if (!sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) limit += PAGE
      },
      { rootMargin: '800px' }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  })
</script>

<header class="top">
  <div class="brand-row">
    <button class="brand" onclick={() => (filters.saved = false)} aria-label="vegdex, all recipes">
      <img class="logo" src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="28" height="28" /> vegdex
    </button>
    <button
      class="saved-toggle"
      class:on={filters.saved}
      aria-pressed={filters.saved}
      onclick={() => (filters.saved = !filters.saved)}
    >
      <Icon name="heart" size={16} filled /> Saved{saved.ids.length ? ` · ${saved.ids.length}` : ''}
    </button>
  </div>
  <label class="search">
    <span class="visually-hidden">Search recipes</span>
    <input
      type="search"
      placeholder={filters.saved ? 'Search your saved recipes' : 'Search vegan recipes: curry, brownies, tofu…'}
      bind:value={filters.text}
      autocomplete="off"
      enterkeyhint="search"
    />
  </label>
  {#if !filters.saved}<FilterBar count={results.length} />{/if}
</header>

<main>
  {#if error}
    <div class="status">
      <p>{error}</p>
      <button class="text-btn" onclick={load}>Try again</button>
    </div>
  {:else if !catalog}
    <p class="status">Loading recipes…</p>
  {:else}
    <div class="summary">
      <p data-testid="result-count" role="status">
        {`${results.length.toLocaleString()} ${results.length === 1 ? 'recipe' : 'recipes'}${filters.saved ? ' saved' : ''}`}
      </p>
      {#if filters.saved && savedRecipes.length}
        <button class="grocery-btn" onclick={() => (groceryOpen = true)}>Shopping list</button>
      {/if}
    </div>

    {#if !filters.saved}<ActiveFilters />{/if}

    {#if results.length === 0}
      <div class="status">
        {#if filters.saved && !saved.ids.length}
          <p>Nothing saved yet. Tap the heart on a recipe to keep it here.</p>
        {:else}
          <p>
            {filters.saved ? 'None of your saved recipes match' : 'No recipes match'}{filters.text.trim() ? ` “${filters.text.trim()}”` : ''}{!filters.saved && activeCount() ? ' with these filters' : ''}.
          </p>
          {#if filters.text.trim()}<button class="text-btn" onclick={() => (filters.text = '')}>Clear search</button>{/if}
          {#if !filters.saved && activeCount()}<button class="text-btn" onclick={clearFilters}>Clear filters</button>{/if}
        {/if}
      </div>
    {/if}

    <ul class="grid">
      {#each visible as recipe (recipe.id)}
        <li>
          <RecipeCard {recipe} sourceName={sourceNames.get(recipe.source) ?? recipe.source} onopen={() => (openId = recipe.id)} />
        </li>
      {/each}
    </ul>
    {#if visible.length < results.length}
      <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
    {/if}

    <footer class="credits">
      Recipes from {catalog.sources.length} vegan blogs. vegdex shows ingredients and links to the creator for the method.
      Updated {new Date(catalog.generatedAt).toLocaleDateString()}.
    </footer>
  {/if}
</main>

{#if open}
  <RecipeSheet recipe={open} sourceName={sourceNames.get(open.source) ?? open.source} onclose={() => (openId = null)} />
{/if}

{#if groceryOpen}
  <GrocerySheet recipes={savedRecipes} onclose={() => (groceryOpen = false)} />
{/if}
