<script lang="ts">
  import type { FreeFrom, Meal } from '@vegdex/core'
  import { activeCount, clearFilters, filters, type Sort } from './state.svelte'

  const MEAL_LABELS: [Meal, string][] = [
    ['breakfast', 'Breakfast'],
    ['main', 'Mains'],
    ['soup', 'Soups'],
    ['salad', 'Salads'],
    ['side', 'Sides'],
    ['snack', 'Snacks'],
    ['dessert', 'Desserts'],
    ['baking', 'Baking'],
    ['drink', 'Drinks'],
    ['sauce', 'Sauces & dips']
  ]
  const TIMES = [15, 30, 45, 60]
  const FREE: [FreeFrom, string][] = [
    ['gluten-free', 'Gluten-free'],
    ['nut-free', 'Nut-free'],
    ['soy-free', 'Soy-free'],
    ['oil-free', 'Oil-free']
  ]
  const SORTS: [Sort, string][] = [
    ['rating', 'Top rated'],
    ['newest', 'Newest'],
    ['fastest', 'Fastest'],
    ['relevance', 'Best match']
  ]

  let more = $state(false)
  let have = $state('')
  let avoid = $state('')

  function toggleMeal(m: Meal) {
    filters.meals = filters.meals.includes(m) ? filters.meals.filter((x) => x !== m) : [...filters.meals, m]
  }
  function toggleFree(f: FreeFrom) {
    filters.freeFrom = filters.freeFrom.includes(f) ? filters.freeFrom.filter((x) => x !== f) : [...filters.freeFrom, f]
  }
  function addTo(kind: 'include' | 'exclude', e: SubmitEvent) {
    e.preventDefault()
    const value = (kind === 'include' ? have : avoid).trim().toLowerCase()
    if (value && !filters[kind].includes(value)) filters[kind] = [...filters[kind], value]
    if (kind === 'include') have = ''
    else avoid = ''
  }
  function remove(kind: 'include' | 'exclude', v: string) {
    filters[kind] = filters[kind].filter((x) => x !== v)
  }
</script>

<nav class="pills" aria-label="Quick filters">
  <button class="pill" class:on={filters.flavor === 'savory'} aria-pressed={filters.flavor === 'savory'}
    onclick={() => (filters.flavor = filters.flavor === 'savory' ? null : 'savory')}>Savory</button>
  <button class="pill" class:on={filters.flavor === 'sweet'} aria-pressed={filters.flavor === 'sweet'}
    onclick={() => (filters.flavor = filters.flavor === 'sweet' ? null : 'sweet')}>Sweet</button>
  <span class="divider" aria-hidden="true"></span>
  {#each MEAL_LABELS as [meal, label] (meal)}
    <button class="pill" class:on={filters.meals.includes(meal)} aria-pressed={filters.meals.includes(meal)}
      onclick={() => toggleMeal(meal)}>{label}</button>
  {/each}
</nav>

<div class="pills secondary">
  <button class="pill outline" class:on={more} aria-expanded={more} onclick={() => (more = !more)}>
    More filters{activeCount() ? ` · ${activeCount()}` : ''}
  </button>
  {#each TIMES as t (t)}
    <button class="pill outline" class:on={filters.maxMinutes === t} aria-pressed={filters.maxMinutes === t}
      onclick={() => (filters.maxMinutes = filters.maxMinutes === t ? null : t)}>≤ {t} min</button>
  {/each}
  <button class="pill outline" class:on={filters.highProtein} aria-pressed={filters.highProtein}
    onclick={() => (filters.highProtein = !filters.highProtein)}>High protein</button>
</div>

{#if more}
  <section class="more" aria-label="More filters">
    <div class="row">
      <span class="label">Free from</span>
      <div class="pills wrap">
        {#each FREE as [f, label] (f)}
          <button class="pill outline" class:on={filters.freeFrom.includes(f)} aria-pressed={filters.freeFrom.includes(f)}
            onclick={() => toggleFree(f)}>{label}</button>
        {/each}
      </div>
    </div>

    <form class="row" onsubmit={(e) => addTo('include', e)}>
      <label class="label" for="have">I have</label>
      <input id="have" bind:value={have} placeholder="e.g. tofu, spinach" autocomplete="off" />
      <button class="small">Add</button>
    </form>
    {#if filters.include.length}
      <div class="chips">
        {#each filters.include as v (v)}
          <button class="chip have" onclick={() => remove('include', v)} aria-label="Remove {v}">{v} ×</button>
        {/each}
      </div>
    {/if}

    <form class="row" onsubmit={(e) => addTo('exclude', e)}>
      <label class="label" for="avoid">Avoid</label>
      <input id="avoid" bind:value={avoid} placeholder="e.g. mushrooms, coconut" autocomplete="off" />
      <button class="small">Add</button>
    </form>
    {#if filters.exclude.length}
      <div class="chips">
        {#each filters.exclude as v (v)}
          <button class="chip avoid" onclick={() => remove('exclude', v)} aria-label="Remove {v}">no {v} ×</button>
        {/each}
      </div>
    {/if}

    <div class="row">
      <label class="label" for="sort">Sort</label>
      <select id="sort" bind:value={filters.sort}>
        <option value={null}>Default</option>
        {#each SORTS as [s, label] (s)}
          <option value={s}>{label}</option>
        {/each}
      </select>
      {#if activeCount()}
        <button class="small ghost" onclick={clearFilters}>Clear all</button>
      {/if}
    </div>
  </section>
{/if}
