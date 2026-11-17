<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
  import { haptic } from './haptic'
  import { m, countArgs, formatNumber, formatRating } from './i18n'
  import Icon from './Icon.svelte'
  import { formatMinutes } from './labels'
  import { closeSheet, sheet } from './sheet'
  import { saved, toggleSaved } from './state.svelte'
  import { recipeTitle, titleLang } from './translations.svelte'

  let { pool, sourceName, onopen, onlist, onclose }: {
    /** The best matches for the cook's filters, best first; the deck shuffles them. */
    pool: CatalogRecipe[]
    sourceName: (id: string) => string
    onopen: (recipe: CatalogRecipe) => void
    /** Open the shopping list from the deck. */
    onlist: () => void
    onclose: () => void
  } = $props()

  /** Cards drawn into view under the top one: enough to see a stack, few enough to stay light. */
  const STACK = 3
  /** A drag past this share of the card's width decides it, as does a flick. */
  const DECIDE = 0.28
  const FLICK = 0.6

  const shuffle = (list: CatalogRecipe[]) => {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out
  }
  // Dealt once when the deck opens; Shuffle again deals the same matches anew.
  const deal = () => shuffle(pool)
  let deck = $state.raw(deal())
  let at = $state(0)
  /** Saved from this deck, for the count and the way to the list. */
  let kept = $state<string[]>([])
  let busy = false
  let top = $state<HTMLElement>()
  let hint = $state<'save' | 'skip' | null>(null)

  const stack = $derived(deck.slice(at, at + STACK))
  const current = $derived(deck[at])
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  /** The top card leaves to the right (saved) or the left (skipped), then the next one comes up. */
  async function decide(save: boolean, from = 0) {
    const card = current
    if (!card || busy) return
    busy = true
    hint = null
    if (save) {
      if (!saved.ids.includes(card.id)) toggleSaved(card.id)
      if (!kept.includes(card.id)) kept = [...kept, card.id]
      haptic('save')
    } else {
      haptic('select')
    }
    const el = top
    if (el && !still()) {
      const width = el.offsetWidth
      const dir = save ? 1 : -1
      await el.animate([
        { transform: `translateX(${from}px) rotate(${(from / width) * 14}deg)` },
        { transform: `translateX(${dir * width * 1.3}px) rotate(${dir * 22}deg)`, opacity: 0 }
      ], { duration: 260, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }).finished.catch(() => {})
    }
    at += 1
    busy = false
  }

  // Dragging moves the card under the finger; letting go decides it, or it springs back.
  let start: { x: number; y: number; t: number; id: number } | null = null
  let dx = 0
  let moved = false
  function down(e: PointerEvent) {
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return
    start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    dx = 0
    moved = false
  }
  function move(e: PointerEvent) {
    if (!start || e.pointerId !== start.id || !top) return
    dx = e.clientX - start.x
    const dy = e.clientY - start.y
    // A mostly vertical move is the page scrolling, not a swipe.
    if (!moved && Math.abs(dx) < 8) return
    if (!moved && Math.abs(dy) > Math.abs(dx)) return void (start = null)
    if (!moved) top.setPointerCapture(e.pointerId)
    moved = true
    top.style.transform = `translateX(${dx}px) rotate(${(dx / top.offsetWidth) * 14}deg)`
    hint = Math.abs(dx) > top.offsetWidth * DECIDE * 0.5 ? (dx > 0 ? 'save' : 'skip') : null
  }
  function up(e: PointerEvent) {
    if (!start || e.pointerId !== start.id || !top) return
    const width = top.offsetWidth
    const speed = Math.abs(dx) / Math.max(e.timeStamp - start.t, 1)
    start = null
    if (!moved) return
    if (Math.abs(dx) > width * DECIDE || speed > FLICK) {
      const from = dx
      top.style.transform = ''
      void decide(dx > 0, from)
      return
    }
    hint = null
    const back = top.style.transform
    top.style.transform = ''
    if (!still()) top.animate([{ transform: back }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  }
  // A tap that did not drag opens the recipe.
  function tap(e: MouseEvent) {
    if (moved) {
      e.preventDefault()
      moved = false
      return
    }
    if (current) onopen(current)
  }
  function keys(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowRight') { e.preventDefault(); void decide(true) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide(false) }
  }
  function again() {
    deck = deal()
    at = 0
    haptic('draw')
  }
</script>

<dialog use:sheet class="sheet deck-sheet" aria-labelledby="deck-title" {onclose} onkeydown={keys}>
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <h2 id="deck-title">{m.deck_title()}</h2>
    <p class="hint">{m.deck_hint()}</p>

    <div class="deck" data-testid="deck">
      {#if current}
        <!-- The stack, bottom card first, so the top card paints last. -->
        {#each [...stack].reverse() as recipe, i (recipe.id)}
          {@const depth = stack.length - 1 - i}
          {#if depth === 0}
            <article class="deck-card deck-top" class:lean-save={hint === 'save'} class:lean-skip={hint === 'skip'} bind:this={top}
              onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-roledescription={m.deck_card()}>
              <button class="deck-open" onclick={tap} aria-label={m.deck_open({ title: recipeTitle(recipe) })}>
                {#if recipe.image}<img src={recipe.image} alt="" draggable="false" />{:else}<span class="deck-photo"></span>{/if}
                <span class="stamp stamp-save" aria-hidden="true">{m.deck_stamp_save()}</span>
                <span class="stamp stamp-skip" aria-hidden="true">{m.deck_stamp_skip()}</span>
                {#if recipe.minutes}<span class="time">{formatMinutes(recipe.minutes)}</span>{/if}
              </button>
              <div class="deck-facts">
                <h3 lang={titleLang(recipe)}>{recipeTitle(recipe)}</h3>
                <p class="meta">
                  <span>{sourceName(recipe.source)}</span>
                  {#if recipe.rating && recipe.ratingCount}<span class="rating"><Icon name="star" size={12} filled /> {formatRating(recipe.rating)} · {m.rating_count({ ...countArgs(recipe.ratingCount), count: formatNumber(recipe.ratingCount) })}</span>{/if}
                </p>
              </div>
            </article>
          {:else}
            <div class="deck-card deck-under" style:--depth={depth} aria-hidden="true">
              {#if recipe.image}<img src={recipe.image} alt="" draggable="false" />{:else}<span class="deck-photo"></span>{/if}
            </div>
          {/if}
        {/each}
      {:else}
        <div class="deck-end">
          <p class="empty-sign">{m.deck_end_title()}</p>
          <p>{m.deck_end(countArgs(deck.length))}</p>
          <button class="pill outline" onclick={again}><Icon name="shuffle" size={16} /> {m.deck_again()}</button>
        </div>
      {/if}
    </div>
    {#if current}
      <p class="visually-hidden" role="status">{recipeTitle(current)}</p>
    {/if}

    <!-- One row under the deck: skip, the way to the list once something is saved (else how far in), keep. -->
    <div class="deck-keys">
      <button class="deck-key skip" onclick={() => decide(false)} disabled={!current} aria-label={m.deck_skip()} title={m.deck_skip()}><Icon name="close" size={26} /></button>
      {#if kept.length}
        <button class="deck-list" onclick={(e) => { closeSheet(e.currentTarget.closest('dialog')); onlist() }} aria-label="{m.shopping_list()} · {m.deck_kept(countArgs(kept.length))}">
          <Icon name="list" size={18} /> <span aria-hidden="true">{m.deck_kept(countArgs(kept.length))}</span>
        </button>
      {:else}
        <span class="deck-progress" aria-hidden="true">{current ? `${formatNumber(at + 1)} / ${formatNumber(deck.length)}` : ''}</span>
      {/if}
      <button class="deck-key keep" onclick={() => decide(true)} disabled={!current} aria-label={m.deck_save()} title={m.deck_save()}><Icon name="heart" size={26} filled /></button>
    </div>
  </div>
</dialog>
