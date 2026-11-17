<script lang="ts">
  import type { CatalogRecipe, RecipeQuery } from '@vegdex/core'
  import { catalog, type Week } from './catalog-client'
  import { conceptName } from './concept-names.svelte'
  import { haptic } from './haptic'
  import { m, countArgs, formatNumber } from './i18n'
  import Icon from './Icon.svelte'
  import { formatMinutes } from './labels'
  import { latest } from './reactive/latest.svelte'
  import { closeSheet, sheet } from './sheet'
  import { saveAll, shopOnly } from './state.svelte'
  import { recipeTitle, titleLang } from './translations.svelte'

  let { query, sourceName, onopen, onlist, onclose }: {
    /** The cook's filters; the week draws its dinners from their matches. */
    query: RecipeQuery
    sourceName: (id: string) => string
    onopen: (recipe: CatalogRecipe) => void
    /** The week is saved: open the shopping list. */
    onlist: () => void
    onclose: () => void
  } = $props()

  const MIN = 3
  const MAX = 7
  /**
   * What the planner is asked: how many dinners, the ones the cook keeps (null fills a slot), and the ones
   * turned down this visit, which a swap never brings back. Only the cook's taps change it.
   */
  let ask = $state<{ count: number; slots: (string | null)[]; avoid: string[] }>({ count: 5, slots: [], avoid: [] })
  let week = $state.raw<Week | null>(null)
  let failed = $state(false)

  latest(
    () => {
      const { count, slots, avoid } = $state.snapshot(ask)
      return catalog.week($state.snapshot(query), count, slots, avoid)
    },
    (answer) => {
      week = answer
      failed = false
    },
    () => (failed = true)
  )

  const recipes = $derived(week?.recipes ?? [])
  const ids = $derived(recipes.map((r) => r.id))
  const stats = $derived(week?.stats)
  const shared = $derived((stats?.shared ?? []).slice(0, 6).map((s) => ({ ...s, name: conceptName(s.concept) })).filter((s) => s.name))

  function swap(id: string) {
    haptic('select')
    ask = { count: ask.count, slots: ids.map((s) => (s === id ? null : s)), avoid: [...ask.avoid, id] }
  }
  function reshuffle() {
    haptic('draw')
    ask = { count: ask.count, slots: [], avoid: [...ask.avoid, ...ids] }
  }
  function resize(by: number) {
    const count = Math.min(Math.max(ask.count + by, MIN), MAX)
    if (count !== ask.count) ask = { count, slots: ids.slice(0, count), avoid: ask.avoid }
  }
  function shop(dialog: HTMLDialogElement | null) {
    saveAll(ids)
    shopOnly(ids)
    haptic('save')
    closeSheet(dialog)
    onlist()
  }
</script>

<dialog use:sheet class="sheet week-sheet" aria-labelledby="week-title" {onclose}>
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <h2 id="week-title">{m.week_title()}</h2>
    <p class="hint">{m.week_hint()}</p>

    <div class="week-count">
      <span class="label" id="week-count-label">{m.week_dinners_label()}</span>
      <span class="stepper" role="group" aria-labelledby="week-count-label">
        <button aria-disabled={ask.count === MIN} onclick={() => resize(-1)} aria-label={m.week_fewer()}>−</button>
        <span class="value" aria-live="polite">{m.week_dinners(countArgs(ask.count))}</span>
        <button aria-disabled={ask.count === MAX} onclick={() => resize(1)} aria-label={m.week_more()}>+</button>
      </span>
    </div>

    {#if failed}
      <p class="muted">{m.load_error()}</p>
    {:else if !week}
      <p class="muted" role="status">{m.week_planning()}</p>
    {:else if !recipes.length}
      <p class="muted">{m.week_none()}</p>
    {:else}
      {#if stats}
        <!-- The point of a planned week, in one line: one shop, fewer things. -->
        <p class="week-shop" data-testid="week-shop">
          <strong>{m.week_items(countArgs(stats.items))}</strong>
          {#if stats.separate > stats.items}<span class="muted">{m.week_instead({ count: formatNumber(stats.separate) })}</span>{/if}
        </p>
        {#if shared.length}
          <ul class="week-shared" aria-label={m.week_shared()}>
            {#each shared as s (s.concept)}<li>{s.name} <span class="times">×{formatNumber(s.recipes)}</span></li>{/each}
          </ul>
        {/if}
      {/if}
      <ol class="week-list" data-testid="week-list">
        {#each recipes as recipe, i (recipe.id)}
          <li class="week-row">
            <span class="day" aria-hidden="true">{formatNumber(i + 1)}</span>
            <button class="week-open" onclick={() => onopen(recipe)}>
              {#if recipe.image}<img src={recipe.image} alt="" loading="lazy" decoding="async" />{:else}<span class="week-thumb"></span>{/if}
              <span class="week-text">
                <span class="week-name" lang={titleLang(recipe)}>{recipeTitle(recipe)}</span>
                <span class="meta">{#if recipe.minutes}<span class="week-time">{formatMinutes(recipe.minutes)}</span>{' · '}{/if}{sourceName(recipe.source)}</span>
              </span>
            </button>
            <button class="week-swap" onclick={() => swap(recipe.id)} aria-label={m.week_swap({ title: recipeTitle(recipe) })} title={m.week_swap({ title: recipeTitle(recipe) })}>
              <Icon name="shuffle" size={18} />
            </button>
          </li>
        {/each}
      </ol>
    {/if}

    <div class="sheet-footer">
      <button class="text-btn" onclick={reshuffle} disabled={!recipes.length}>{m.week_new()}</button>
      <button class="cta" disabled={!recipes.length} onclick={(e) => shop(e.currentTarget.closest('dialog'))}>
        <Icon name="list" size={18} /> {m.week_shop()}
      </button>
    </div>
  </div>
</dialog>
