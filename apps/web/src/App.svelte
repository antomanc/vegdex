<script lang="ts">
  import { searchRecipes, type Catalog, type CatalogRecipe } from '@vegdex/core'
  import { loadCatalog } from './lib/data'
  import {
    activeCount, activeFilters, clearFilters, defaultSort, filters, readUrl, removeFilter, saved, toQuery, writeUrl,
    type Sort
  } from './lib/state.svelte'
  import { SORTS } from './lib/labels'
  import { onSheetPop } from './lib/sheet'
  import FilterBar from './lib/FilterBar.svelte'
  import ActiveFilters from './lib/ActiveFilters.svelte'
  import Icon from './lib/Icon.svelte'
  import RecipeCard from './lib/RecipeCard.svelte'
  import RecipeSheet from './lib/RecipeSheet.svelte'
  import GrocerySheet from './lib/GrocerySheet.svelte'

  const PAGE = 48
  // Past this many, more recipes load on request, so the credits at the bottom can be reached.
  const AUTO_LIMIT = PAGE * 4

  const initial = readUrl()
  let catalog = $state<Catalog | null>(null)
  let error = $state<string | null>(null)
  let openId = $state<string | null>(initial.openId)
  let groceryOpen = $state(initial.listOpen)
  let limit = $state(PAGE)
  let sentinel = $state<HTMLElement>()
  let headerHeight = $state(0)
  let filterBox = $state<HTMLElement>()
  let filtersOutOfView = $state(false)

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
  // Recipes unsaved in this visit to the saved view stay listed, so a mis-tap on the heart can be undone.
  const listedIds = $derived([...saved.ids, ...saved.unsaved])
  const results = $derived<CatalogRecipe[]>(catalog ? searchRecipes(catalog.recipes, toQuery(listedIds)) : [])
  const resultCount = $derived(filters.saved ? results.filter((r) => saved.ids.includes(r.id)).length : results.length)
  const visible = $derived(results.slice(0, limit))
  const open = $derived(openId && catalog ? catalog.recipes.find((r) => r.id === openId) ?? null : null)
  const savedRecipes = $derived(catalog ? catalog.recipes.filter((r) => saved.ids.includes(r.id)) : [])
  const countText = $derived(`${resultCount.toLocaleString()} ${resultCount === 1 ? 'recipe' : 'recipes'}${filters.saved ? ' saved' : ''}`)
  const blogCount = $derived(new Set(results.map((r) => r.source)).size)
  const sorts = $derived(SORTS.filter(([s]) => s !== 'relevance' || filters.text.trim()))

  /** At zero results, the one change that brings back the most recipes. */
  const loosen = $derived.by(() => {
    if (!catalog || results.length || filters.saved) return null
    const active = activeFilters()
    const options = active.map((f) => ({ label: `Remove “${f.label}”`, apply: () => removeFilter(f), patch: f.patch, isSearch: false }))
    if (filters.text.trim()) options.push({ label: 'Clear the search', apply: () => (filters.text = ''), patch: { text: '' }, isSearch: true })
    let best: { label: string; apply: () => void; n: number; isSearch: boolean } | null = null
    for (const o of options) {
      const n = searchRecipes(catalog.recipes, toQuery([], { ...filters, ...o.patch })).length
      if (n && (!best || n > best.n)) best = { ...o, n }
    }
    return best
  })

  // Screen readers hear the count once typing settles, not on every keystroke.
  let announced = $state('')
  $effect(() => {
    const text = countText
    const t = setTimeout(() => (announced = catalog ? text : ''), 700)
    return () => clearTimeout(t)
  })

  // New filters start from the top of the list.
  $effect(() => {
    toQuery(saved.ids)
    limit = PAGE
  })

  $effect(() => writeUrl(openId, groceryOpen))
  onSheetPop(() => writeUrl(openId, groceryOpen))

  // Leaving the saved view makes its unsaves final.
  $effect(() => {
    if (!filters.saved) saved.unsaved = []
  })

  // Keyboard focus and in-page jumps land below the sticky header, not under it.
  $effect(() => {
    document.documentElement.style.setProperty('--header-h', `${headerHeight}px`)
  })

  $effect(() => {
    if (!filterBox) return
    const io = new IntersectionObserver(([e]) => (filtersOutOfView = !e!.isIntersecting && e!.boundingClientRect.top < 0), {
      rootMargin: `-${headerHeight}px 0px 0px 0px`
    })
    io.observe(filterBox)
    return () => io.disconnect()
  })

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

  function toFilters() {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' })
  }

  function setSort(value: Sort) {
    filters.sort = value === defaultSort() ? null : value
  }
</script>

<header class="top" bind:offsetHeight={headerHeight}>
  <div class="brand-row">
    <h1 class="brand-h">
      <button class="brand" onclick={() => (filters.saved = false)} aria-label="vegdex, all recipes">
        <img class="logo" src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="28" height="28" /> vegdex
      </button>
    </h1>
    <div class="top-actions">
      {#if filtersOutOfView && !filters.saved}
        <button class="pill outline jump" onclick={toFilters}>
          <Icon name="sliders" size={16} /> Filters{activeCount() ? ` · ${activeCount()}` : ''}
        </button>
      {/if}
      <button
        class="saved-toggle"
        class:on={filters.saved}
        aria-pressed={filters.saved}
        onclick={() => (filters.saved = !filters.saved)}
      >
        <Icon name="heart" size={16} filled /> Saved{saved.ids.length ? ` · ${saved.ids.length}` : ''}
      </button>
    </div>
  </div>
  <label class="search">
    <span class="visually-hidden">Search recipes</span>
    <Icon name="search" size={18} />
    <input
      type="search"
      placeholder={filters.saved ? 'Search your saved recipes' : 'Search recipes or ingredients'}
      bind:value={filters.text}
      autocomplete="off"
      enterkeyhint="search"
    />
  </label>
</header>

<main>
  {#if !filters.saved}
    <div class="filters" bind:this={filterBox}><FilterBar count={results.length} /></div>
  {/if}

  {#if error}
    <div class="status">
      <p>{error}</p>
      <button class="text-btn" onclick={load}>Try again</button>
    </div>
  {:else if !catalog}
    <p class="visually-hidden" role="status">Loading recipes…</p>
    <ul class="grid skeleton" aria-hidden="true">
      {#each Array(6) as _, i (i)}<li><div class="thumb"></div><div class="bar"></div><div class="bar short"></div></li>{/each}
    </ul>
  {:else}
    {#if filters.saved}
      <div class="view-head">
        <h2>Saved recipes</h2>
        {#if savedRecipes.length}
          <button class="grocery-btn" onclick={() => (groceryOpen = true)}><Icon name="list" size={16} /> Shopping list</button>
        {/if}
      </div>
    {/if}

    {#if results.length}
      <div class="summary">
        <p>
          <span data-testid="result-count">{countText}</span>{#if !filters.saved}<span class="from">{' '}from {blogCount} vegan {blogCount === 1 ? 'blog' : 'blogs'}</span>{/if}
        </p>
        <label class="sort">
          <span class="visually-hidden">Sort by</span>
          <select value={filters.sort ?? defaultSort()} onchange={(e) => setSort(e.currentTarget.value as Sort)}>
            {#each sorts as [s, label] (s)}<option value={s}>{label}</option>{/each}
          </select>
        </label>
      </div>
    {:else}
      <p class="visually-hidden" data-testid="result-count">{countText}</p>
    {/if}
    <p class="visually-hidden" role="status">{announced}</p>

    {#if !filters.saved}<ActiveFilters showClear={results.length > 0} />{/if}

    {#if results.length === 0}
      <div class="status empty">
        {#if filters.saved && !saved.ids.length}
          <p>Nothing saved yet. Tap the heart on a recipe to keep it here.</p>
          <button class="text-btn" onclick={() => (filters.saved = false)}>Browse recipes</button>
        {:else}
          <p>
            {filters.saved ? 'None of your saved recipes match' : 'No recipes match'}{filters.text.trim() ? ` “${filters.text.trim()}”` : ''}{!filters.saved && activeCount() ? ' with these filters' : ''}.
          </p>
          {#if loosen}
            <button class="loosen" onclick={loosen.apply}>
              {loosen.label} <span class="n">{loosen.n.toLocaleString()} {loosen.n === 1 ? 'recipe' : 'recipes'}</span>
            </button>
          {/if}
          <div class="row center">
            {#if filters.text.trim() && !loosen?.isSearch}<button class="text-btn" onclick={() => (filters.text = '')}>Clear search</button>{/if}
            {#if !filters.saved && activeCount()}<button class="text-btn" onclick={clearFilters}>Clear filters</button>{/if}
          </div>
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
      {#if limit < AUTO_LIMIT}
        <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
      {:else}
        <div class="more">
          <button class="pill outline" onclick={() => (limit += PAGE)}>Show more recipes</button>
          <p class="meta">Showing {visible.length.toLocaleString()} of {results.length.toLocaleString()}</p>
        </div>
      {/if}
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

{#if groceryOpen && catalog}
  <GrocerySheet recipes={savedRecipes} onclose={() => (groceryOpen = false)} />
{/if}
