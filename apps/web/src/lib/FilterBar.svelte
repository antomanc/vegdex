<script lang="ts">
  import type { FreeFrom, Meal } from '@vegdex/core'
  import Icon from './Icon.svelte'
  import { FREE, MEAL_LABELS, SORTS, TIMES } from './labels'
  import { activeCount, clearFilters, filters, moreCount } from './state.svelte'

  let { count }: { count: number } = $props()

  let more = $state(false)
  let dialog = $state<HTMLDialogElement>()

  $effect(() => {
    dialog?.showModal()
  })
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
  <button class="pill outline" class:on={moreCount() > 0} aria-haspopup="dialog" onclick={() => (more = true)}>
    More filters{moreCount() ? ` · ${moreCount()}` : ''}
  </button>
  {#each TIMES as t (t)}
    <button class="pill outline" class:on={filters.maxMinutes === t} aria-pressed={filters.maxMinutes === t}
      onclick={() => (filters.maxMinutes = filters.maxMinutes === t ? null : t)}>≤ {t} min</button>
  {/each}
  <button class="pill outline" class:on={filters.highProtein} aria-pressed={filters.highProtein}
    onclick={() => (filters.highProtein = !filters.highProtein)}>High protein</button>
</div>

{#if more}
  <dialog bind:this={dialog} class="sheet" aria-labelledby="more-title" onclose={() => (more = false)}
    onclick={(e) => e.target === dialog && dialog?.close()}>
    <div class="sheet-body">
      <div class="sheet-top"><button class="close" onclick={() => dialog?.close()} aria-label="Close"><Icon name="close" size={20} /></button></div>
      <h2 id="more-title">More filters</h2>

      <fieldset class="field">
        <legend class="label">Free from</legend>
        <div class="pills wrap">
          {#each FREE as [f, label] (f)}
            <button class="pill outline" class:on={filters.freeFrom.includes(f)} aria-pressed={filters.freeFrom.includes(f)}
              onclick={() => toggleFree(f)}>{label}</button>
          {/each}
        </div>
      </fieldset>

      <form class="field" onsubmit={(e) => addTo('include', e)}>
        <label class="label" for="have">I have</label>
        <div class="input-row">
          <input id="have" bind:value={have} placeholder="e.g. tofu, spinach" autocomplete="off" enterkeyhint="done" />
          <button class="btn-sm">Add</button>
        </div>
        {#if filters.include.length}
          <div class="chips">
            {#each filters.include as v (v)}
              <button class="chip have" onclick={() => remove('include', v)} aria-label="Remove {v}">{v} <Icon name="close" size={12} /></button>
            {/each}
          </div>
        {/if}
      </form>

      <form class="field" onsubmit={(e) => addTo('exclude', e)}>
        <label class="label" for="avoid">Avoid</label>
        <div class="input-row">
          <input id="avoid" bind:value={avoid} placeholder="e.g. mushrooms, coconut" autocomplete="off" enterkeyhint="done" />
          <button class="btn-sm">Add</button>
        </div>
        {#if filters.exclude.length}
          <div class="chips">
            {#each filters.exclude as v (v)}
              <button class="chip avoid" onclick={() => remove('exclude', v)} aria-label="Remove {v}">no {v} <Icon name="close" size={12} /></button>
            {/each}
          </div>
        {/if}
      </form>

      <div class="field">
        <label class="label" for="sort">Sort</label>
        <select id="sort" bind:value={filters.sort}>
          <option value={null}>Top rated (best match when searching)</option>
          {#each SORTS as [s, label] (s)}
            <option value={s}>{label}</option>
          {/each}
        </select>
      </div>

      <div class="sheet-footer">
        {#if activeCount()}<button class="text-btn" onclick={clearFilters}>Clear all</button>{/if}
        <button class="cta" onclick={() => dialog?.close()}>Show {count.toLocaleString()} {count === 1 ? 'recipe' : 'recipes'}</button>
      </div>
    </div>
  </dialog>
{/if}
