<script lang="ts">
  import { tick } from 'svelte'
  import type { FreeFrom, Meal } from '@vegdex/core'
  import { loadSuggestions } from './data'
  import { m, countArgs, formatNumber, pageLocale } from './i18n'
  import Icon from './Icon.svelte'
  import IngredientField from './IngredientField.svelte'
  import { FREE, MEAL_LABELS, TIMES } from './labels'
  import { closeSheet, sheet } from './sheet'
  import { activeCount, clearFilters, filters, isTonight, moreCount, toggleTonight } from './state.svelte'

  // null until the catalog answers: the button says what it does without a count.
  let { count, onpick }: { count: number | null; onpick?: () => void } = $props()

  /** Mains through Desserts head the first line of signs. */
  const FIRST_LINE = 7
  let more = $state(false)
  let signRow = $state<HTMLElement>()
  /** Brings a sign fully into the scrolling row, clear of the fade at its right edge. */
  function reveal(sign: HTMLElement | null | undefined) {
    if (!signRow || !sign) return
    const left = sign.offsetLeft - signRow.offsetLeft
    const edge = 16
    if (left < signRow.scrollLeft + edge) signRow.scrollLeft = left - edge
    else if (left + sign.offsetWidth > signRow.scrollLeft + signRow.clientWidth - 44) signRow.scrollLeft = left + sign.offsetWidth - signRow.clientWidth + 56
  }
  // A chosen sign, also one set by Tonight or a shared link, slides into view.
  $effect(() => {
    void [filters.flavor, filters.meals]
    tick().then(() => reveal(signRow?.querySelector<HTMLElement>('.tab.on')))
  })
  let have = $state('')
  let avoid = $state('')
  let names = $state<{ name: string; lower: string }[]>([])
  const pending = $derived(Boolean(have.trim() || avoid.trim()))
  // Fetched the first time an ingredient input gets focus, so the first card never waits for it.
  async function suggest() {
    if (!names.length) names = (await loadSuggestions(pageLocale.code)).map((name) => ({ name, lower: name.toLowerCase() }))
  }
  // Names keep their case for display ("Old Bay", "lenticchie di Puy"); the filters store what was typed, lowercased.
  const chosen = $derived(new Set([...filters.include, ...filters.exclude]))

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
  function picked(kind: 'include' | 'exclude', value: string) {
    if (kind === 'include') have = value
    else avoid = value
    commit(kind)
  }
  function remove(kind: 'include' | 'exclude', v: string) {
    filters[kind] = filters[kind].filter((x) => x !== v)
  }
  // Text still in a field would otherwise come back when the sheet closes.
  function clearAll() {
    have = ''
    avoid = ''
    clearFilters()
  }
  // Text typed but not added still counts when the sheet closes.
  function closed() {
    commit('include')
    commit('exclude')
    more = false
  }
</script>

<!-- "≤ 15 min": on phones only the last time spells out its unit, so the row fits. -->
{#snippet time(label: string)}
  {@const cut = label.lastIndexOf(' ')}
  {label.slice(0, cut)}<span class="seg-unit">{' '}{label.slice(cut + 1)}</span>
{/snippet}
<!-- The stall's signs, in two lines that scroll together: dinner courses lead, then flavor and the rest. -->
{#snippet meal([meal, label]: [Meal, string])}
  <button class="tab" class:on={filters.meals.includes(meal)} aria-pressed={filters.meals.includes(meal)}
    onclick={() => toggleMeal(meal)}>{label}</button>
{/snippet}
<nav class="tabs" aria-label={m.categories()}>
  <div class="tab-row" bind:this={signRow} onfocusin={(e) => reveal(e.target as HTMLElement)}><div class="tab-track">
    <div class="tab-line">
      {#each MEAL_LABELS.slice(0, FIRST_LINE) as entry (entry[0])}{@render meal(entry)}{/each}
    </div>
    <div class="tab-line">
      <button class="tab savory" class:on={filters.flavor === 'savory'} aria-pressed={filters.flavor === 'savory'}
        onclick={() => (filters.flavor = filters.flavor === 'savory' ? null : 'savory')}>{m.savory()}</button>
      <button class="tab sweet" class:on={filters.flavor === 'sweet'} aria-pressed={filters.flavor === 'sweet'}
        onclick={() => (filters.flavor = filters.flavor === 'sweet' ? null : 'sweet')}>{m.sweet()}</button>
      {#each MEAL_LABELS.slice(FIRST_LINE) as entry (entry[0])}{@render meal(entry)}{/each}
    </div>
  </div></div>
</nav>

<div class="pills controls">
  <button class="pill tonight" class:on={isTonight()} aria-pressed={isTonight()} title={m.tonight_hint()} onclick={toggleTonight}>
    <Icon name="clock" size={16} /> {m.tonight()}
  </button>
  <div class="segmented" role="group" aria-label={m.ready_in()}>
    {#each TIMES as t (t)}
      <button class="seg" class:on={filters.maxMinutes === t} aria-pressed={filters.maxMinutes === t}
        onclick={() => (filters.maxMinutes = filters.maxMinutes === t ? null : t)}>{@render time(m.time_limit({ count: formatNumber(t) }))}</button>
    {/each}
  </div>
  <!-- On phones this is a round key; its label stays for screen readers. -->
  <button class="pill outline more-key" class:on={moreCount() > 0} aria-haspopup="dialog" onclick={() => (more = true)}>
    <Icon name="sliders" size={16} /> <span class="more-label">{m.more_filters()}{moreCount() ? ` · ${formatNumber(moreCount())}` : ''}</span>
    {#if moreCount()}<span class="more-count" aria-hidden="true">{formatNumber(moreCount())}</span>{/if}
  </button>
  <!-- Wide screens: Pick ends this row, so it never covers a photo; the dock's copy shows on phones. -->
  {#if onpick}<button class="pick pick-inline" onclick={onpick}><Icon name="shuffle" size={16} /> {m.pick()}</button>{/if}
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
        <p class="hint" id="have-hint">{m.include_hint()}</p>
        <div class="input-row">
          <IngredientField id="have" bind:value={have} {names} {chosen} placeholder={m.include_example()} describedby="have-hint" onfocus={suggest} onpick={(v) => picked('include', v)} />
          {#if have.trim()}<button class="btn-sm">{m.add()}</button>{/if}
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
          <IngredientField id="avoid" bind:value={avoid} {names} {chosen} placeholder={m.avoid_example()} describedby="avoid-hint" onfocus={suggest} onpick={(v) => picked('exclude', v)} />
          {#if avoid.trim()}<button class="btn-sm">{m.add()}</button>{/if}
        </div>
        {#if filters.exclude.length}
          <div class="chips">
            {#each filters.exclude as v (v)}
              <button class="chip avoid" onclick={() => remove('exclude', v)} aria-label={m.remove({ label: v })}>{m.without({ ingredient: v })} <Icon name="close" size={12} /></button>
            {/each}
          </div>
        {/if}
      </form>

      <div class="sheet-footer">
        {#if activeCount()}<button class="text-btn" onclick={clearAll}>{m.clear_all()}</button>{/if}
        <!-- Text still in a field joins the filters on close, so the count would be stale: say what the tap does instead. -->
        <button class="cta" class:none={!pending && count === 0} onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))}>
          {pending ? m.add_and_show() : count === null ? m.show_results() : count === 0 ? m.no_matches_filter() : m.show_recipes(countArgs(count))}
        </button>
      </div>
    </div>
  </dialog>
{/if}
