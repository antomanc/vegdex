<script lang="ts">
  import type { CatalogRecipe } from '@vegdex/core'
  import { loadIngredients } from './data'
  import Icon from './Icon.svelte'
  import { m, countArgs, formatNumber, formatRating, pageLocale } from './i18n'
  import { FREE, cuisineLabel, formatMinutes, splitLine } from './labels'
  import { sheet } from './sheet'
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
  // A new draw swaps the recipe in the open sheet: start it from the top.
  $effect(() => {
    recipe.id
    broken = false
    if (dialog) dialog.scrollTop = 0
  })
  const ingredients = $derived(loadIngredients(recipe.id))
  const isSaved = $derived(saved.ids.includes(recipe.id))
  const reportUrl = $derived(`https://github.com/antomanc/vegdex/issues/new?${new URLSearchParams({
    title: `Recipe problem: ${recipe.title}`,
    body: `Recipe ID: ${recipe.id}\nSource: ${recipe.url}\nUI language: ${pageLocale.code}\n\nPlease describe the problem:\n`
  })}`)

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
    <div class="sheet-top"><button class="close" onclick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <div class="recipe-head">
    {#if recipe.image && !broken}
      <img class="hero" src={recipe.image} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
    {/if}
    <h2 id="sheet-title">{recipe.title}</h2>
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
            {#if recipe.calories}{m.calories({ count: formatNumber(Math.round(recipe.calories)) })}{/if}{#if recipe.calories && recipe.protein}<br />{/if}{#if recipe.protein}{m.protein({ count: formatNumber(Math.round(recipe.protein)) })}{/if}
          </dd>
        </div>
      {/if}
    </dl>
    {#if diet.length || cuisines.length}
      <ul class="badges">
        {#each diet as b (b)}<li>{b}</li>{/each}
        {#each cuisines as b (b)}<li class="cuisine">{b}</li>{/each}
      </ul>
    {/if}
    </div>

    <div class="recipe-ingredients">
    <div class="ingredients-head"><h3>{m.ingredients()}</h3><UnitsToggle /></div>
    {#await ingredients}
      <p class="muted">{m.loading()}</p>
    {:then lines}
      {@const split = lines.map((line) => splitLine(line, prefs.units))}
      <ul class="ingredients" data-testid="ingredients">
        {#each split as [amount, rest], i (i)}<li>{#if amount}<span class="amount">{amount}</span>{' '}{/if}{rest}</li>{/each}
      </ul>
      {#if split.some(([amount]) => amount.startsWith('≈'))}
        <p class="muted small">{m.metric_note()}</p>
      {/if}
    {:catch}
      <p class="muted">{m.ingredients_offline({ source: sourceName })}</p>
    {/await}
    <p class="muted small">{m.creator_credit({ source: sourceName })}</p>
    <p class="muted small"><a href={reportUrl} target="_blank" rel="noopener">{m.report_problem()}</a></p>
    </div>

    <div class="sheet-footer actions">
      <button class="save" class:on={isSaved} aria-pressed={isSaved} onclick={() => toggleSaved(recipe.id)}>
        <Icon name="heart" size={18} filled={isSaved} /> {isSaved ? m.saved_recipe() : m.save()}
      </button>
      {#if ondraw}
        <button class="save" onclick={ondraw}><Icon name="shuffle" size={18} /> {m.another()}</button>
      {/if}
      <a class="cta" href={recipe.url} target="_blank" rel="noopener">
        <span>{m.cook_on({ source: sourceName })}&nbsp;<Icon name="external" size={16} /></span>
      </a>
    </div>
  </div>
</dialog>
