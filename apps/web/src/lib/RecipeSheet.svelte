<script lang="ts">
  import { display, recipeTitle } from './translations.svelte'
  import { isHiddenLine, lineParts, renderIngredient, scaleIngredient, type CatalogRecipe, type ParsedLine } from '@vegdex/core'
  import { loadDetails } from './data'
  import Icon from './Icon.svelte'
  import { m, countArgs, formatNumber, formatRating, pageLocale } from './i18n'
  import { FREE, MAX_BATCHES, batchFactor, cuisineLabel, formatMinutes, perBatch, splitAmount, splitLine, splitParts, stepsLabel } from './labels'
  import { closeSheet, sheet } from './sheet'
  import { prefs, saved, toggleSaved } from './state.svelte'
  import UnitsToggle from './UnitsToggle.svelte'

  let {
    recipe, sourceName, onclose, onkitchen, ondraw
  }: {
    recipe: CatalogRecipe
    sourceName: string
    onclose: () => void
    /** Show every recipe from this recipe's blog. */
    onkitchen: () => void
    /** Present when the card was drawn at random: draw another. */
    ondraw?: () => void
  } = $props()

  let broken = $state(false)
  let dialog = $state<HTMLDialogElement>()
  // Servings for this visit only, in the shopping list's steps; the list keeps its own. A new draw starts at its own yield.
  let chosen = $state<{ id: string; steps: number } | null>(null)
  const steps = $derived(chosen?.id === recipe.id ? chosen.steps : perBatch(recipe))
  const setSteps = (n: number) => (chosen = { id: recipe.id, steps: Math.min(Math.max(n, 1), MAX_BATCHES * perBatch(recipe)) })
  const factor = $derived(steps / perBatch(recipe))
  let copied = $state(false)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  /** The link to copy by hand, when the clipboard refused it. */
  let manualLink = $state('')
  // A new draw swaps the recipe in the open sheet: start it from the top.
  $effect(() => {
    recipe.id
    broken = false
    copied = false
    manualLink = ''
    if (dialog) dialog.scrollTop = 0
  })
  const ingredients = $derived(loadDetails(recipe.id))
  const isSaved = $derived(saved.ids.includes(recipe.id))
  const reportUrl = $derived(`https://github.com/antomanc/vegdex/issues/new?${new URLSearchParams({
    title: `Recipe problem: ${recipe.title}`,
    body: `Recipe ID: ${recipe.id}\nSource: ${recipe.url}\nUI language: ${pageLocale.code}\n\nPlease describe the problem:\n`
  })}`)

  /** The recipe alone, in this page's language: no search, filters or Saved view of the sender. */
  async function share() {
    const url = new URL(location.pathname, location.origin)
    url.searchParams.set('r', recipe.id)
    if (navigator.share) {
      try {
        return await navigator.share({ title: recipeTitle(recipe), url: url.href })
      } catch (e) {
        // Closing the share sheet is a choice, not a failure.
        if ((e as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url.href)
      copied = true
      clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => (copied = false), 2000)
    } catch {
      manualLink = url.href
    }
  }
  const selectAll = (input: HTMLInputElement) => { input.focus(); input.select() }

  /**
   * Each shown line as [amount, rest, kept as written while scaled].
   * At the blog's own yield nothing changes; scaled, a line vegdex cannot compose keeps the blog's amount, and says so.
   */
  function ingredientRows(lines: string[], parsedIngredients: ParsedLine[] | undefined): [string, string, boolean][] {
    const source = recipe.contentLanguage ?? 'en'
    const same = pageLocale.code === source
    const render = (p: Parameters<typeof renderIngredient>[0]) =>
      renderIngredient(factor === 1 ? p : scaleIngredient(p, factor, prefs.units), display.overlay ?? undefined, pageLocale.code, prefs.units, source)
    const asWritten = (row: [string, string], measured: boolean): [string, string, boolean] => [...row, factor !== 1 && measured]
    return lines.flatMap((line, i): [string, string, boolean][] => {
      const shipped = parsedIngredients?.[i]
      const parts = shipped ? lineParts(shipped) : []
      const measured = parts.some((p) => p.quantity)
      // "2 tsp cornstarch + 2 tbsp water": as written in its own language, one line per part in another.
      if (parts.length > 1) {
        const rendered = parts.map(render)
        const composed = rendered.every((r) => r !== null) ? (rendered as [string, string][]) : null
        if (same) {
          if (factor === 1 || !composed) return [asWritten(splitParts(line, prefs.units, parts), measured)]
          const [[amount, rest], ...others] = composed
          return [[amount, [rest, ...others.map(([a, r]) => `${a} ${r}`.trim())].join(' + '), false]]
        }
        return composed ? composed.map(([a, r]) => [a, r, false]) : [asWritten(splitAmount(line), measured)]
      }
      const parsed = parts[0]
      // Only ingredients show: equipment and asides never, headings only in the recipe's own language.
      if (isHiddenLine(parsed, pageLocale.code, source)) return []
      const rendered = parsed && render(parsed)
      if (rendered) return [[...rendered, false]]
      // A line vegdex cannot compose stays exactly as written in another language: no half-translated lines.
      return [asWritten(same ? splitLine(line, prefs.units, parsed) : splitAmount(line), measured)]
    })
  }

  const LABELS: Record<string, string> = {
    ...Object.fromEntries(FREE.map(([id, label]) => [`free:${id}`, label])),
    'high-protein': m.high_protein()
  }
  const diet = $derived(recipe.tags.flatMap((t) => (LABELS[t] ? [LABELS[t]] : [])))
  const cuisines = $derived(
    recipe.tags.flatMap((t) => (t.startsWith('cuisine:') ? [cuisineLabel(t.slice(8))] : []))
  )
</script>

<dialog use:sheet bind:this={dialog} class="sheet recipe-sheet" class:sweet={recipe.tags.includes('flavor:sweet')} {onclose} aria-labelledby="sheet-title">
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <div class="recipe-head">
    {#if recipe.image && !broken}
      <img class="hero" src={recipe.image} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
    {/if}
    <h2 id="sheet-title">{recipeTitle(recipe)}</h2>
    {#if recipeTitle(recipe) !== recipe.title}<p class="muted original-title" lang={recipe.contentLanguage ?? 'en'}>{recipe.title}</p>{/if}
    <p class="kitchen">
      <span>{m.from_kitchen()} <button class="kitchen-name" onclick={onkitchen} aria-label={m.source_recipes({ source: sourceName })}>{sourceName}</button></span>
      {#if recipe.rating && recipe.ratingCount}<span class="rating"><Icon name="star" size={13} filled /><span class="visually-hidden">{m.rated()}</span> {formatRating(recipe.rating)} <span class="muted">({m.rating_total(countArgs(recipe.ratingCount))})</span></span>{/if}
    </p>
    <!-- The printed fields of a recipe card, under its red line. -->
    <dl class="card-fields">
      {#if recipe.minutes}<div><dt>{m.time()}</dt><dd>{formatMinutes(recipe.minutes)}</dd></div>{/if}
      {#if recipe.servings}<div><dt>{m.serves()}</dt><dd>{formatNumber(recipe.servings)}</dd></div>{/if}
      {#if recipe.calories || recipe.protein}
        <div>
          <dt>{m.per_serving()}</dt>
          <dd>
            {#if recipe.calories}<span>{m.calories({ count: formatNumber(Math.round(recipe.calories)) })}</span>{/if}{#if recipe.calories && recipe.protein}<br />{/if}{#if recipe.protein}<span>{m.protein({ count: formatNumber(Math.round(recipe.protein)) })}</span>{/if}
          </dd>
        </div>
      {/if}
    </dl>
    {#if diet.length || cuisines.length}
      <ul class="badges">
        {#each diet as b (b)}<li>{b}</li>{/each}
        {#each cuisines as b (b)}<li class="cuisine">{b}</li>{/each}
      </ul>
      <p class="muted small">{m.diet_note()}</p>
    {/if}
    </div>

    <div class="recipe-ingredients">
    <div class="ingredients-head"><h3>{m.ingredients()}</h3><UnitsToggle /></div>
    <div class="servings-row">
      <span class="stepper">
        <button aria-disabled={steps === 1} onclick={() => setSteps(steps - 1)} aria-label={m.fewer_servings_here()}>−</button>
        <span class="value" aria-live="polite">{stepsLabel(recipe, steps)}</span>
        <button aria-disabled={steps === MAX_BATCHES * perBatch(recipe)} onclick={() => setSteps(steps + 1)} aria-label={m.more_servings_here()}>+</button>
      </span>
      {#if factor !== 1}
        <button class="text-btn" onclick={() => setSteps(perBatch(recipe))}>{m.scale_reset()}</button>
      {/if}
    </div>
    {#if factor !== 1}
      <p class="muted small scale-note" data-testid="scale-note">
        {recipe.servings ? m.scaled_servings({ original: formatNumber(recipe.servings), count: formatNumber(steps) }) : m.scaled_batch({ factor: batchFactor(steps) })}.
        {m.scale_method_note({ source: sourceName })}
      </p>
    {/if}
    {#await ingredients}
      <p class="muted">{m.loading()}</p>
    {:then { ingredients: lines, parsedIngredients }}
      {@const split = ingredientRows(lines, parsedIngredients)}
      <ul class="ingredients" data-testid="ingredients">
        {#each split as [amount, rest, kept], i (i)}<li>{#if amount}<span class="amount">{amount}</span>{' '}{/if}{rest}{#if kept}{' '}<span class="muted not-scaled">({m.not_scaled()})</span>{/if}</li>{/each}
      </ul>
      {#if split.some(([amount]) => amount.startsWith('≈'))}
        <p class="muted small">{m.metric_note()}</p>
      {/if}
      {#if pageLocale.code !== (recipe.contentLanguage ?? 'en')}
        <details class="original-ingredients">
          <summary>{m.original_ingredients()}</summary>
          <ul class="ingredients" data-testid="original-ingredients" lang={recipe.contentLanguage ?? 'en'}>
            {#each lines as line, i (i)}<li>{line}</li>{/each}
          </ul>
        </details>
      {/if}
    {:catch}
      <p class="muted">{m.ingredients_offline({ source: sourceName })}</p>
    {/await}
    <p class="muted small">{m.creator_credit({ source: sourceName })}</p>
    <p class="muted small"><a href={reportUrl} target="_blank" rel="noopener">{m.report_problem()}</a></p>
    </div>

    {#if manualLink}
      <label class="share-link">
        <span class="muted small">{m.share_link()}</span>
        <input readonly value={manualLink} use:selectAll onfocus={(e) => e.currentTarget.select()} />
      </label>
    {/if}
    <div class="sheet-footer actions">
      <div class="recipe-secondary-actions">
        <button class="save" class:on={isSaved} aria-pressed={isSaved} onclick={() => toggleSaved(recipe.id)}>
          <Icon name="heart" size={18} filled={isSaved} /> {isSaved ? m.saved_recipe() : m.save()}
        </button>
        {#if ondraw}
          <button class="save" onclick={ondraw}><Icon name="shuffle" size={18} /> {m.another()}</button>
        {/if}
        <button class="save share" class:copied onclick={share} aria-label={m.share()} title={m.share()}>
          <span class="swap"><Icon name="share" size={18} /><Icon name="check" size={18} /></span>
          <span class="bubble" aria-hidden="true">{m.link_copied()}</span>
        </button>
        <span class="visually-hidden" role="status">{copied ? m.link_copied() : ''}</span>
      </div>
      <a class="cta" href={recipe.url} target="_blank" rel="noopener">
        <span>{m.cook_on({ source: sourceName })}&nbsp;<Icon name="external" size={16} /></span>
      </a>
    </div>
  </div>
</dialog>
