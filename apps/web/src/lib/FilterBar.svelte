<script lang="ts">
  import type { FreeFrom, Meal } from '@vegdex/core'
  import { loadSuggestions } from './data'
  import { m, countArgs, formatNumber, pageLocale } from './i18n'
  import Icon from './Icon.svelte'
  import { FREE, MEAL_LABELS, TIMES } from './labels'
  import { closeSheet, sheet } from './sheet'
  import { activeCount, clearFilters, filters, isTonight, moreCount, toggleTonight } from './state.svelte'

  // null until the catalog answers: the button says what it does without a count.
  let { count }: { count: number | null } = $props()

  let more = $state(false)
  let have = $state('')
  let avoid = $state('')
  let names = $state<string[]>([])
  const pending = $derived(Boolean(have.trim() || avoid.trim()))
  // What the focused input holds: the datalist is native UI, and Safari rebuilds its popup from
  // every option on each keystroke, so it only ever gets a short, matching list.
  let query = $state('')
  const OFFERED = 50
  // Fetched the first time an ingredient input gets focus, so the first card never waits for it.
  async function suggest(e: FocusEvent) {
    query = (e.currentTarget as HTMLInputElement).value
    if (!names.length) names = await loadSuggestions(pageLocale.code)
  }
  // Names keep their case for display ("Old Bay", "lenticchie di Puy"); the filters store what was typed, lowercased.
  const chosen = $derived(new Set([...filters.include, ...filters.exclude]))
  const offered = $derived.by(() => {
    const text = query.trim().toLowerCase()
    const free = names.filter((n) => !chosen.has(n.toLowerCase()))
    if (!text) return free.slice(0, OFFERED)
    // Prefix matches first: that is what the browser itself still filters by.
    const prefixes: string[] = []
    const inside: string[] = []
    for (const name of free) {
      const lower = name.toLowerCase()
      if (lower.startsWith(text)) prefixes.push(name)
      else if (lower.includes(text)) inside.push(name)
    }
    return [...prefixes, ...inside].slice(0, OFFERED)
  })

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
    query = ''
  }
  function add(kind: 'include' | 'exclude', e: SubmitEvent) {
    e.preventDefault()
    commit(kind)
  }
  // Picking a suggestion replaces the text without typing it (no inputType, or insertReplacementText): add it right away.
  function picked(kind: 'include' | 'exclude', e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const value = input.value.trim().toLowerCase()
    const typed = e instanceof InputEvent && e.inputType !== 'insertReplacementText'
    if (typed || !names.some((n) => n.toLowerCase() === value)) {
      query = input.value
      return
    }
    if (kind === 'include') have = value
    else avoid = value
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

<!-- The stall's signs: flavor, then the courses. -->
<nav class="tabs" aria-label={m.categories()}>
  <div class="tab-row"><div class="tab-track">
    <button class="tab savory" class:on={filters.flavor === 'savory'} aria-pressed={filters.flavor === 'savory'}
      onclick={() => (filters.flavor = filters.flavor === 'savory' ? null : 'savory')}>{m.savory()}</button>
    <button class="tab sweet" class:on={filters.flavor === 'sweet'} aria-pressed={filters.flavor === 'sweet'}
      onclick={() => (filters.flavor = filters.flavor === 'sweet' ? null : 'sweet')}>{m.sweet()}</button>
    {#each MEAL_LABELS as [meal, label] (meal)}
      <button class="tab" class:on={filters.meals.includes(meal)} aria-pressed={filters.meals.includes(meal)}
        onclick={() => toggleMeal(meal)}>{label}</button>
    {/each}
  </div></div>
</nav>

<div class="pills controls">
  <button class="pill tonight" class:on={isTonight()} aria-pressed={isTonight()} title={m.tonight_hint()} onclick={toggleTonight}>
    <Icon name="clock" size={16} /> {m.tonight()}
  </button>
  <button class="pill outline" class:on={moreCount() > 0} aria-haspopup="dialog" onclick={() => (more = true)}>
    <Icon name="sliders" size={16} /> {m.more_filters()}{moreCount() ? ` · ${formatNumber(moreCount())}` : ''}
  </button>
  <div class="segmented" role="group" aria-label={m.ready_in()}>
    {#each TIMES as t (t)}
      <button class="seg" class:on={filters.maxMinutes === t} aria-pressed={filters.maxMinutes === t}
        onclick={() => (filters.maxMinutes = filters.maxMinutes === t ? null : t)}>{m.time_limit({ count: formatNumber(t) })}</button>
    {/each}
  </div>
</div>

{#if more}
  <dialog use:sheet class="sheet" aria-labelledby="more-title" onclose={closed}>
    <div class="sheet-body">
      <div class="sheet-top"><button class="close" onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
      <h2 id="more-title">{m.more_filters()}</h2>
      <fieldset class="field">
        <legend class="visually-hidden">{m.high_protein()}</legend>
        <div class="choice-grid"><button class="pill outline" class:on={filters.highProtein} aria-pressed={filters.highProtein} onclick={() => (filters.highProtein = !filters.highProtein)}>{m.high_protein()}</button></div>
        <p class="hint">{m.protein_hint()}</p>
      </fieldset>

      <fieldset class="field">
        <legend class="label">{m.free_from()}</legend>
        <p class="hint">{m.diet_note()}</p>
        <div class="choice-grid">
          {#each FREE as [f, label] (f)}
            <button class="pill outline" class:on={filters.freeFrom.includes(f)} aria-pressed={filters.freeFrom.includes(f)}
              onclick={() => toggleFree(f)}>{label}</button>
          {/each}
        </div>
      </fieldset>

      <form class="field" onsubmit={(e) => add('include', e)}>
        <label class="label" for="have">{m.must_include()}</label>
        <p class="hint" id="have-hint">{m.include_hint()} {m.pending_hint()}</p>
        <div class="input-row">
          <input id="have" bind:value={have} list="ingredient-names" onfocus={suggest} oninput={(e) => picked('include', e)} placeholder={m.include_example()} autocomplete="off" enterkeyhint="done" aria-describedby="have-hint" />
          <button class="btn-sm" disabled={!have.trim()}>{m.add()}</button>
        </div>
        {#if filters.include.length}
          <div class="chips">
            {#each filters.include as v (v)}
              <button class="chip have" onclick={() => remove('include', v)} aria-label={m.remove({ label: v })}>{v} <Icon name="close" size={12} /></button>
            {/each}
          </div>
        {/if}
      </form>

      <form class="field" onsubmit={(e) => add('exclude', e)}>
        <label class="label" for="avoid">{m.avoid()}</label>
        <p class="hint" id="avoid-hint">{m.exclude_hint()}</p>
        <div class="input-row">
          <input id="avoid" bind:value={avoid} list="ingredient-names" onfocus={suggest} oninput={(e) => picked('exclude', e)} placeholder={m.avoid_example()} autocomplete="off" enterkeyhint="done" aria-describedby="avoid-hint" />
          <button class="btn-sm" disabled={!avoid.trim()}>{m.add()}</button>
        </div>
        {#if filters.exclude.length}
          <div class="chips">
            {#each filters.exclude as v (v)}
              <button class="chip avoid" onclick={() => remove('exclude', v)} aria-label={m.remove({ label: v })}>{m.without({ ingredient: v })} <Icon name="close" size={12} /></button>
            {/each}
          </div>
        {/if}
      </form>

      <datalist id="ingredient-names">
        {#each offered as name (name)}<option value={name}></option>{/each}
      </datalist>

      <div class="sheet-footer">
        {#if activeCount()}<button class="text-btn" onclick={clearFilters}>{m.clear_all()}</button>{/if}
        <!-- Text still in a field joins the filters on close, so the count would be stale: say what the tap does instead. -->
        <button class="cta" class:none={!pending && count === 0} onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))}>
          {pending ? m.add_and_show() : count === null ? m.show_results() : count === 0 ? m.no_matches_filter() : m.show_recipes(countArgs(count))}
        </button>
      </div>
    </div>
  </dialog>
{/if}
