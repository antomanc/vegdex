<script lang="ts">
  import { untrack } from 'svelte'
  import { searchRecipes, type Catalog, type CatalogRecipe, type IngredientLookup } from '@vegdex/core'
  import { loadCatalog, loadLookup } from './lib/data'
  import {
    activeCount, activeFilters, clearFilters, defaultSort, filters, forgetUnsavedAmounts, readUrl, removeFilter, saved, sourceNames, toQuery, writeUrl,
    type Sort
  } from './lib/state.svelte'
  import { m, countArgs, formatNumber, pageLocale } from './lib/i18n'
  import { LOCALES } from './lib/locales'
  import { isLocale } from './paraglide/runtime'
  import { SORTS } from './lib/labels'
  import { onSheetPop } from './lib/sheet'
  import { theme, toggleTheme } from './lib/theme.svelte'
  import FilterBar from './lib/FilterBar.svelte'
  import ActiveFilters from './lib/ActiveFilters.svelte'
  import Icon from './lib/Icon.svelte'
  import RecipeCard from './lib/RecipeCard.svelte'
  import RecipeSheet from './lib/RecipeSheet.svelte'
  import GrocerySheet from './lib/GrocerySheet.svelte'
  import LanguageSuggestion from './lib/LanguageSuggestion.svelte'

  const PAGE = 48
  // Past this many, more recipes load on request, so the credits at the bottom can be reached.
  const AUTO_LIMIT = PAGE * 4

  const initial = readUrl()
  let catalog = $state<Catalog | null>(null)
  let lookup = $state<IngredientLookup>({})
  let error = $state<string | null>(null)
  let openId = $state<string | null>(initial.openId)
  // Opened by "Pick for me": the sheet offers another draw.
  let drawn = $state(false)
  let groceryOpen = $state(initial.listOpen)
  let limit = $state(PAGE)
  let sentinel = $state<HTMLElement>()
  let headerHeight = $state(0)
  let filterBox = $state<HTMLElement>()
  let filtersOutOfView = $state(false)
  let queryString = $state(location.search)

  function load() {
    error = null
    loadCatalog()
      .then(async (c) => {
        lookup = c.recipes.some((r) => r.concepts) ? (await loadLookup(pageLocale.code)).aliases : {}
        for (const s of c.sources) sourceNames.set(s.id, s.name)
        catalog = c
      })
      .catch((e: Error) => {
        console.error(e)
        error = m.load_error()
      })
  }
  load()

  const kitchen = $derived(filters.from && !filters.saved ? catalog?.sources.find((s) => s.id === filters.from) ?? null : null)
  // Recipes unsaved in this visit to the saved view stay listed, so a mis-tap on the heart can be undone.
  const listedIds = $derived([...saved.ids, ...saved.unsaved])
  const results = $derived<CatalogRecipe[]>(catalog ? searchRecipes(catalog.recipes, toQuery(listedIds), lookup) : [])
  const resultCount = $derived(filters.saved ? results.filter((r) => saved.ids.includes(r.id)).length : results.length)
  const visible = $derived(results.slice(0, limit))
  const open = $derived(openId && catalog ? catalog.recipes.find((r) => r.id === openId) ?? null : null)
  const savedRecipes = $derived(catalog ? catalog.recipes.filter((r) => saved.ids.includes(r.id)) : [])
  const countText = $derived(filters.saved ? m.saved_count(countArgs(resultCount)) : m.recipe_count(countArgs(resultCount)))
  const blogCount = $derived(new Set(results.map((r) => r.source)).size)
  const sorts = $derived(SORTS.filter(([s]) => s !== 'relevance' || filters.text.trim()))

  /** At zero results, the one change that brings back the most recipes. */
  const loosen = $derived.by(() => {
    if (!catalog || results.length || filters.saved) return null
    const active = activeFilters()
    const options = active.map((f) => ({ label: m.remove_suggestion({ label: f.label }), apply: () => removeFilter(f), patch: f.patch, isSearch: false }))
    if (filters.text.trim()) options.push({ label: m.clear_the_search(), apply: () => (filters.text = ''), patch: { text: '' }, isSearch: true })
    let best: { label: string; apply: () => void; n: number; isSearch: boolean } | null = null
    for (const o of options) {
      const n = searchRecipes(catalog.recipes, toQuery([], { ...filters, ...o.patch }), lookup).length
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

  $effect(() => {
    writeUrl(openId, groceryOpen)
    queryString = location.search
  })
  onSheetPop(() => writeUrl(openId, groceryOpen))

  // Leaving the saved view makes its unsaves final.
  $effect(() => {
    if (!filters.saved) {
      saved.unsaved = []
      untrack(forgetUnsavedAmounts)
    }
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

  // Draw from the best of the current matches, never the card already open.
  const DRAW_POOL = 120
  function pick() {
    const pool = results.slice(0, DRAW_POOL).filter((r) => r.id !== openId)
    if (!pool.length) return
    openId = pool[Math.floor(Math.random() * pool.length)]!.id
    drawn = true
  }

  function showKitchen(id: string) {
    openId = null
    filters.saved = false
    filters.from = id
    scrollTo({ top: 0 })
  }

  function setSort(value: Sort) {
    filters.sort = value === defaultSort() ? null : value
  }
</script>

<header class="top" bind:offsetHeight={headerHeight}>
  <div class="brand-row">
    <h1 class="brand-h">
      <button class="brand" onclick={() => (filters.saved = false)} aria-label={m.all_recipes()}>
        <img class="logo" src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="28" height="28" /> vegdex
      </button>
    </h1>
    <div class="top-actions">
      {#if filtersOutOfView && !filters.saved}
        <button class="pill outline jump" onclick={toFilters}>
          <Icon name="sliders" size={16} /> {m.filters()}{activeCount() ? ` · ${formatNumber(activeCount())}` : ''}
        </button>
      {/if}
      <button class="night" aria-pressed={theme.dark} aria-label={m.night_mode()} title={m.night_mode()} onclick={toggleTheme}>
        <Icon name={theme.dark ? 'sun' : 'moon'} size={18} />
      </button>
      <button
        class="saved-toggle"
        class:on={filters.saved}
        aria-pressed={filters.saved}
        onclick={() => (filters.saved = !filters.saved)}
      >
        <Icon name="heart" size={16} filled />
        <span class="tight-hide">{m.saved()}{saved.ids.length ? ' · ' : ''}</span>{saved.ids.length ? formatNumber(saved.ids.length) : ''}
      </button>
    </div>
  </div>
  <label class="search">
    <span class="visually-hidden">{m.search_recipes()}</span>
    <Icon name="search" size={18} />
    <input
      type="search"
      placeholder={filters.saved ? m.search_saved() : m.search_placeholder()}
      bind:value={filters.text}
      autocomplete="off"
      enterkeyhint="search"
    />
  </label>
</header>

<main>
  <LanguageSuggestion {queryString} />
  {#if !filters.saved}
    <div class="filters" bind:this={filterBox}><FilterBar count={results.length} onpick={pick} /></div>
  {/if}

  {#if error}
    <div class="status">
      <p>{error}</p>
      <button class="text-btn" onclick={load}>{m.try_again()}</button>
    </div>
  {:else if !catalog}
    <p class="visually-hidden" role="status">{m.loading_recipes()}</p>
    <ul class="grid skeleton" aria-hidden="true">
      {#each Array(6) as _, i (i)}<li><div class="thumb"></div><div class="bar"></div><div class="bar short"></div></li>{/each}
    </ul>
  {:else}
    {#if filters.saved}
      <div class="view-head">
        <h2>{m.saved_recipes()}</h2>
        {#if savedRecipes.length}
          <button class="grocery-btn" onclick={() => (groceryOpen = true)}><Icon name="list" size={16} /> {m.shopping_list()}</button>
        {/if}
      </div>
    {/if}

    {#if kitchen}
      <div class="kitchen-head">
        <h2>{kitchen.name}</h2>
        <a href={kitchen.url} target="_blank" rel="noopener">{m.visit({ host: new URL(kitchen.url).hostname.replace(/^www\./, '') })}&nbsp;<Icon name="external" size={14} /></a>
      </div>
    {/if}

    {#if results.length}
      <div class="summary">
        <p>
          <span data-testid="result-count">{countText}</span>{#if !filters.saved && !kitchen}<span class="from">{' '}{m.blog_count(countArgs(blogCount))}</span>{/if}
        </p>
        <label class="sort">
          <span class="visually-hidden">{m.sort_by()}</span>
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
          <p>{m.saved_empty()}</p>
          <button class="text-btn" onclick={() => (filters.saved = false)}>{m.browse()}</button>
        {:else}
          <p>
            {(filters.saved ? m.no_saved_match : m.no_match)({ search: filters.text.trim() ? m.search_term({ text: filters.text.trim() }) : '', filters: !filters.saved && activeCount() ? m.with_filters() : '' })}
          </p>
          {#if loosen}
            <button class="loosen" onclick={loosen.apply}>
              {loosen.label} <span class="n">{m.recipe_count(countArgs(loosen.n))}</span>
            </button>
          {/if}
          <div class="row center">
            {#if filters.text.trim() && !loosen?.isSearch}<button class="text-btn" onclick={() => (filters.text = '')}>{m.clear_search()}</button>{/if}
            {#if !filters.saved && activeCount()}<button class="text-btn" onclick={clearFilters}>{m.clear_filters()}</button>{/if}
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
          <button class="pill outline" onclick={() => (limit += PAGE)}>{m.show_more()}</button>
          <p class="meta">{m.showing({ visible: formatNumber(visible.length), total: formatNumber(results.length) })}</p>
        </div>
      {/if}
    {/if}

    <footer class="credits">
      {m.credits(countArgs(catalog.sources.length))}
      {m.credits_updated({ date: new Date(catalog.generatedAt).toLocaleDateString(pageLocale.intl) })}
      <div>{m.dictionary_credit()} <a href="https://world.openfoodfacts.org/">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a> · <a href="{import.meta.env.BASE_URL}data/dictionary.json">{m.dictionary_tables()}</a></div>
      <div class="row center">
        {#each LOCALES.filter((locale) => locale.code !== pageLocale.code) as locale (locale.code)}
          {#if isLocale(locale.code)}
            <a href="{import.meta.env.BASE_URL}{locale.prefix ? `${locale.prefix}/` : ''}{queryString}" lang={locale.code} hreflang={locale.hreflang}>{m.language_name({}, { locale: locale.code })}</a>
          {/if}
        {/each}
      </div>
    </footer>
  {/if}
</main>

{#if open}
  <RecipeSheet
    recipe={open}
    sourceName={sourceNames.get(open.source) ?? open.source}
    onclose={() => ((openId = null), (drawn = false))}
    onkitchen={() => showKitchen(open.source)}
    ondraw={drawn ? pick : undefined}
  />
{/if}

{#if groceryOpen && catalog}
  <GrocerySheet recipes={savedRecipes} onclose={() => (groceryOpen = false)} />
{/if}
