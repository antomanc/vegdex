<script lang="ts">
  import { untrack } from 'svelte'
  import { searchRecipes, type Catalog, type CatalogRecipe } from '@vegdex/core'
  import { catalog, type Found, type Loaded } from './lib/catalog-client'
  import { loadCatalogData, loadFirstPage, loadLookup } from './lib/data'
  import {
    activeCount, activeFilters, clearFilters, defaultSort, filters, forgetUnsavedAmounts, isLanding, readUrl, removeFilter, saved, sourceNames, toQuery, writeUrl,
    type Sort
  } from './lib/state.svelte'
  import { m, countArgs, formatNumber, pageLocale } from './lib/i18n'
  import { BASE_LOCALE, LOCALES } from './lib/locales'
  import { display, loadTranslations, recipeTitles } from './lib/translations.svelte'
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
  // Cards in the first rows on a phone or a wide screen.
  const EAGER = 4

  const initial = readUrl()
  // The catalog itself lives in a worker (lib/catalog.worker.ts); the page holds what it shows.
  let loaded = $state.raw<Loaded | null>(null)
  let found = $state.raw<Found | null>(null)
  // The best-rated recipes, shown on a plain landing until the catalog is searchable.
  let firstPage = $state.raw<Catalog | null>(null)
  // Titles the worker searches: bumped once it has the page language's titles.
  let titlesVersion = $state(0)
  let error = $state<string | null>(null)
  let openId = $state<string | null>(initial.openId)
  let openRow = $state.raw<CatalogRecipe | null>(null)
  // Null until the worker answers: the shopping list must not open on an empty list and forget its ticks.
  let savedRecipes = $state.raw<CatalogRecipe[] | null>(null)
  // Opened by "Pick for me": the sheet offers another draw.
  let drawn = $state(false)
  let groceryOpen = $state(initial.listOpen)
  let limit = $state(PAGE)
  let sentinel = $state<HTMLElement>()
  let headerHeight = $state(0)
  let filterBox = $state<HTMLElement>()
  let filtersOutOfView = $state(false)
  let scrollY = $state(0)
  let homeButton = $state<HTMLButtonElement>()
  let queryString = $state(location.search)

  function failed(e: Error) {
    console.error(e)
    error = m.load_error()
  }

  function load() {
    error = null
    // A retry loads the catalog into a fresh worker; questions wait for it.
    loaded = null
    // Everything starts at once (index.html preloads it too); the catalog is the long one.
    // Ingredient names only add matches: without them, search still matches the recipes' English names.
    const names = loadLookup(pageLocale.code).then((f) => f.aliases, () => ({}))
    if (!display.loaded) void loadTranslations()
    if (!loaded && isLanding()) {
      void loadFirstPage().then((c) => {
        if (!c || found) return
        for (const s of c.sources) if (!sourceNames.has(s.id)) sourceNames.set(s.id, s.name)
        firstPage = c
      })
    }
    Promise.all([loadCatalogData(), names])
      .then(([data, aliases]) => catalog.load(data, aliases, pageLocale.code))
      .then((l) => {
        for (const s of l.sources) sourceNames.set(s.id, s.name)
        loaded = l
      })
      .catch(failed)
  }
  load()

  // The worker searches display titles too; it gets the page language's titles once they load.
  $effect(() => {
    const titles = display.overlay?.titles ?? null
    if (!loaded) return
    catalog.titles(titles).then(() => titlesVersion++, failed)
  })

  const kitchen = $derived(filters.from && !filters.saved ? loaded?.sources.find((s) => s.id === filters.from) ?? null : null)
  // Recipes unsaved in this visit to the saved view stay listed, so a mis-tap on the heart can be undone.
  const listedIds = $derived([...saved.ids, ...saved.unsaved])

  // Each change asks the worker; an answer that a newer question overtook is dropped.
  let asked = 0
  $effect(() => {
    if (!loaded) return
    const query = $state.snapshot(toQuery(listedIds))
    const countIds = filters.saved ? $state.snapshot(saved.ids) : undefined
    const n = limit
    void titlesVersion
    const id = ++asked
    catalog.search(query, n, countIds).then((f) => { if (id === asked) found = f }, failed)
  })
  const results = $derived(found?.recipes ?? [])
  const total = $derived(found?.total ?? 0)
  const resultCount = $derived(found?.counted ?? 0)
  const visible = $derived(results.slice(0, limit))
  // Before the catalog, a plain landing lists the first page; on other languages, once titles can be shown.
  const early = $derived(
    !found && firstPage && isLanding() && (pageLocale.code === BASE_LOCALE.code || display.loaded)
      ? searchRecipes(firstPage.recipes, toQuery([]), {}, recipeTitles()).slice(0, PAGE)
      : null
  )

  // The open recipe comes from what the page already has, so the sheet never closes while switching;
  // only a recipe opened from a link asks the worker.
  const open = $derived.by(() => {
    if (!openId) return null
    if (openRow?.id === openId) return openRow
    return [...results, ...(found?.top ?? []), ...(early ?? []), ...(savedRecipes ?? [])].find((r) => r.id === openId) ?? null
  })
  $effect(() => {
    const id = openId
    if (!id || !loaded || untrack(() => open)) return
    catalog.rows([id]).then(([row]) => { if (openId === id && row) openRow = row }, failed)
  })

  $effect(() => {
    const ids = $state.snapshot(saved.ids)
    if (!loaded) return
    catalog.rows(ids).then((rows) => (savedRecipes = rows), failed)
  })

  const countText = $derived(filters.saved ? m.saved_count(countArgs(resultCount)) : m.recipe_count(countArgs(resultCount)))
  const blogCount = $derived(found?.blogs ?? 0)
  const sorts = $derived(SORTS.filter(([s]) => s !== 'relevance' || filters.text.trim()))

  /** At zero results, the one filter whose removal brings back the most recipes; the search goes only when no filter can. */
  let loosen = $state.raw<{ label: string; apply: () => void; n: number; isSearch: boolean } | null>(null)
  let loosenAsked = 0
  $effect(() => {
    const id = ++loosenAsked
    if (!found || found.total || filters.saved) return void (loosen = null)
    const active = activeFilters()
    const options = active.map((f) => ({ label: m.remove_suggestion({ label: f.label }), apply: () => removeFilter(f), patch: f.patch, isSearch: false }))
    if (filters.text.trim()) options.push({ label: m.clear_the_search(), apply: () => (filters.text = ''), patch: { text: '' }, isSearch: true })
    const queries = options.map((o) => $state.snapshot(toQuery([], { ...filters, ...o.patch })))
    catalog.counts(queries).then((counts) => {
      if (id !== loosenAsked) return
      let best: typeof loosen = null
      // The search is listed last, so it is offered only when no filter brings recipes back.
      options.forEach((o, i) => { if (counts[i] && (!best || (!o.isSearch && counts[i]! > best.n))) best = { ...o, n: counts[i]! } })
      loosen = best
    }, failed)
  })

  // Screen readers hear the count once typing settles, not on every keystroke.
  let announced = $state('')
  $effect(() => {
    const text = countText
    const t = setTimeout(() => (announced = found ? text : ''), 700)
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
    const pool = (found?.top ?? []).slice(0, DRAW_POOL).filter((r) => r.id !== openId)
    if (!pool.length) return
    openRow = pool[Math.floor(Math.random() * pool.length)]!
    openId = openRow.id
    drawn = true
  }

  function showKitchen(id: string) {
    openId = null
    drawn = false
    filters.saved = false
    filters.from = id
    scrollTo({ top: 0 })
  }

  // The logo leaves the saved view and a blog's shelf for the whole box; the cook's other filters stay.
  function home() {
    filters.saved = false
    filters.from = null
    scrollTo({ top: 0 })
  }

  function setSort(value: Sort) {
    filters.sort = value === defaultSort() ? null : value
  }
</script>

<svelte:window bind:scrollY />

<a class="skip-link" href="#results">{m.skip_to_recipes()}</a>
<header class="top" bind:offsetHeight={headerHeight}>
  <div class="brand-row">
    <h1 class="brand-h">
      <button class="brand" bind:this={homeButton} onclick={home} aria-label={m.all_recipes()}>
        <img class="logo" src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="28" height="28" /> vegdex
      </button>
    </h1>
    <div class="top-actions">
      {#each LOCALES.filter((locale) => locale.code !== pageLocale.code) as locale (locale.code)}
        {#if isLocale(locale.code)}
          <a class="language-switch" aria-label={m.switch_language({ language: m.language_name({}, { locale: locale.code }) })} href="{import.meta.env.BASE_URL}{locale.prefix ? `${locale.prefix}/` : ''}{queryString}" lang={locale.code} hreflang={locale.hreflang}>{m.language_name({}, { locale: locale.code })}</a>
        {/if}
      {/each}
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
    <div class="filters" bind:this={filterBox}><FilterBar count={total} /></div>
  {/if}

  {#if error}
    <div class="status">
      <p>{error}</p>
      <button class="text-btn" onclick={load}>{m.try_again()}</button>
    </div>
  {:else if !found}
    <p class="visually-hidden" role="status">{m.loading_recipes()}</p>
    {#if early}
      <!-- Holds the count line's place, so the cards stay put when the catalog arrives. -->
      <div class="summary" aria-hidden="true"><p>{m.loading_recipes()}</p></div>
      <ul class="grid" data-testid="first-page">
        {#each early as recipe, i (recipe.id)}
          <li><RecipeCard {recipe} sourceName={sourceNames.get(recipe.source) ?? recipe.source} onopen={() => (openId = recipe.id)} eager={i < EAGER} /></li>
        {/each}
      </ul>
    {:else}
      <ul class="grid skeleton" aria-hidden="true">
        {#each Array(6) as _, i (i)}<li><div class="thumb"></div><div class="bar"></div><div class="bar short"></div></li>{/each}
      </ul>
    {/if}
  {:else}
    {#if filters.saved}
      <div class="view-head">
        <h2>{m.saved_recipes()}</h2>
        {#if savedRecipes?.length}
          <button class="grocery-btn" onclick={() => (groceryOpen = true)}><Icon name="list" size={16} /> {m.shopping_list()}</button>
        {/if}
      </div>
    {/if}

    {#if filters.saved}<p class="device-hint">{m.saved_device_hint()}</p>{/if}

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

    <ul class="grid" id="results" tabindex="-1">
      {#each visible as recipe, i (recipe.id)}
        <li>
          <RecipeCard {recipe} sourceName={sourceNames.get(recipe.source) ?? recipe.source} onopen={() => (openId = recipe.id)} eager={i < EAGER} />
        </li>
      {/each}
    </ul>
    {#if visible.length < total}
      {#if limit < AUTO_LIMIT}
        <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
      {:else}
        <div class="more">
          <button class="pill outline" onclick={() => (limit += PAGE)}>{m.show_more()}</button>
          <p class="meta">{m.showing({ visible: formatNumber(visible.length), total: formatNumber(total) })}</p>
        </div>
      {/if}
    {/if}

    <footer class="credits">
      {m.credits(countArgs(loaded!.sources.length))}
      {m.credits_updated({ date: new Date(loaded!.generatedAt).toLocaleDateString(pageLocale.intl) })}
      <div>{m.dictionary_credit()} <span class="nowrap"><a href="https://world.openfoodfacts.org/">Open Food Facts</a> ·</span> <span class="nowrap"><a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a> ·</span> <a href="{import.meta.env.BASE_URL}data/dictionary.json">{m.dictionary_tables()}</a></div>
      <div><a href="https://github.com/antomanc/vegdex">{m.open_source()}</a></div>
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

{#if scrollY > 600}
  <button class="back-top" onclick={() => { toFilters(); homeButton?.focus({ preventScroll: true }) }}>
    <Icon name="arrow-up" size={18} /><span>{m.back_to_top()}</span>
  </button>
{/if}

{#if filtersOutOfView && !filters.saved}
  <button class="filter-return" onclick={toFilters}>
    <Icon name="sliders" size={18} /><span>{m.filters()}{activeCount() ? ` · ${formatNumber(activeCount())}` : ''}</span>
  </button>
{/if}

<!-- One primary action, within thumb reach while browsing. -->
{#if found && total > 0 && !filters.saved}
  <div class="pick-dock"><button class="pick" onclick={pick}><Icon name="shuffle" size={18} /> {m.pick()}</button></div>
{/if}

{#if open}
  <RecipeSheet
    recipe={open}
    sourceName={sourceNames.get(open.source) ?? open.source}
    onclose={() => ((openId = null), (drawn = false))}
    onkitchen={() => showKitchen(open.source)}
    ondraw={drawn ? pick : undefined}
  />
{/if}

{#if groceryOpen && savedRecipes}
  <GrocerySheet recipes={savedRecipes} onclose={() => (groceryOpen = false)} />
{/if}
