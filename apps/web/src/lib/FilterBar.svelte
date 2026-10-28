<script lang="ts">
  import type { FreeFrom, Meal } from '@vegdex/core'
  import Icon from './Icon.svelte'
  import { FREE, MEAL_LABELS, TIMES } from './labels'
  import { sheet } from './sheet'
  import { activeCount, clearFilters, filters, isTonight, moreCount, toggleTonight } from './state.svelte'

  /** `onpick`: open one recipe at random from the best matches. */
  let { count, onpick }: { count: number; onpick: () => void } = $props()

  let more = $state(false)
  let have = $state('')
  let avoid = $state('')

  function toggleMeal(m: Meal) {
    filters.meals = filters.meals.includes(m) ? filters.meals.filter((x) => x !== m) : [...filters.meals, m]
  }
  function toggleFree(f: FreeFrom) {
    filters.freeFrom = filters.freeFrom.includes(f) ? filters.freeFrom.filter((x) => x !== f) : [...filters.freeFrom, f]
  }
  /** "tofu, spinach" adds two ingredients. */
  function commit(kind: 'include' | 'exclude') {
    const values = (kind === 'include' ? have : avoid).split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)
    filters[kind] = [...new Set([...filters[kind], ...values])]
    if (kind === 'include') have = ''
    else avoid = ''
  }
  function add(kind: 'include' | 'exclude', e: SubmitEvent) {
    e.preventDefault()
    commit(kind)
  }
  function remove(kind: 'include' | 'exclude', v: string) {
    filters[kind] = filters[kind].filter((x) => x !== v)
  }
  // Text typed but not added still counts when the sheet closes.
  function closed() {
    commit('include')
    commit('exclude')
    more = false
  }
</script>

<div class="pills controls">
  <button class="pill tonight" class:on={isTonight()} aria-pressed={isTonight()} onclick={toggleTonight}>
    <Icon name="clock" size={16} /> Tonight
  </button>
  <button class="pill pick" disabled={count === 0} onclick={onpick}>
    <Icon name="shuffle" size={16} /> Pick for me
  </button>
  <button class="pill outline" class:on={moreCount() > 0} aria-haspopup="dialog" onclick={() => (more = true)}>
    <Icon name="sliders" size={16} /> More filters{moreCount() ? ` · ${moreCount()}` : ''}
  </button>
  <div class="segmented" role="group" aria-label="Ready in">
    {#each TIMES as t (t)}
      <button class="seg" class:on={filters.maxMinutes === t} aria-pressed={filters.maxMinutes === t}
        onclick={() => (filters.maxMinutes = filters.maxMinutes === t ? null : t)}>≤ {t} min</button>
    {/each}
  </div>
  <button class="pill outline" class:on={filters.highProtein} aria-pressed={filters.highProtein}
    onclick={() => (filters.highProtein = !filters.highProtein)}>High protein</button>
</div>

<!-- The recipe box's dividers: their tabs stand on the edge of the card stack below. -->
<nav class="tabs" aria-label="Categories">
  <div class="tab-row">
    <button class="tab savory" class:on={filters.flavor === 'savory'} aria-pressed={filters.flavor === 'savory'}
      onclick={() => (filters.flavor = filters.flavor === 'savory' ? null : 'savory')}>Savory</button>
    <button class="tab sweet" class:on={filters.flavor === 'sweet'} aria-pressed={filters.flavor === 'sweet'}
      onclick={() => (filters.flavor = filters.flavor === 'sweet' ? null : 'sweet')}>Sweet</button>
    <span class="tab-gap" aria-hidden="true"></span>
    {#each MEAL_LABELS as [meal, label] (meal)}
      <button class="tab" class:on={filters.meals.includes(meal)} aria-pressed={filters.meals.includes(meal)}
        onclick={() => toggleMeal(meal)}>{label}</button>
    {/each}
  </div>
</nav>

{#if more}
  <dialog use:sheet class="sheet" aria-labelledby="more-title" onclose={closed}>
    <div class="sheet-body">
      <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label="Close"><Icon name="close" size={20} /></button></div>
      <h2 id="more-title">More filters</h2>

      <fieldset class="field">
        <legend class="label">Free from</legend>
        <div class="choice-grid">
          {#each FREE as [f, label] (f)}
            <button class="pill outline" class:on={filters.freeFrom.includes(f)} aria-pressed={filters.freeFrom.includes(f)}
              onclick={() => toggleFree(f)}>{label}</button>
          {/each}
        </div>
      </fieldset>

      <form class="field" onsubmit={(e) => add('include', e)}>
        <label class="label" for="have">Must include</label>
        <p class="hint" id="have-hint">Recipes that use every ingredient you add.</p>
        <div class="input-row">
          <input id="have" bind:value={have} placeholder="e.g. tofu, spinach" autocomplete="off" enterkeyhint="done" aria-describedby="have-hint" />
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

      <form class="field" onsubmit={(e) => add('exclude', e)}>
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

      <div class="sheet-footer">
        {#if activeCount()}<button class="text-btn" onclick={clearFilters}>Clear all</button>{/if}
        <button class="cta" class:none={count === 0} onclick={(e) => e.currentTarget.closest('dialog')?.close()}>
          {count === 0 ? 'No matches. Loosen a filter' : `Show ${count.toLocaleString()} ${count === 1 ? 'recipe' : 'recipes'}`}
        </button>
      </div>
    </div>
  </dialog>
{/if}
