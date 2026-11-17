<script lang="ts">
  import { loadSuggestions } from './data'
  import { m, countArgs, pageLocale } from './i18n'
  import Icon from './Icon.svelte'
  import IngredientField from './IngredientField.svelte'
  import { closeSheet, sheet } from './sheet'
  import { catalog } from './catalog-client'
  import { latest } from './reactive/latest.svelte'
  import { filters, fridge, setFridge, toQuery } from './state.svelte'

  let { onclose }: { onclose: () => void } = $props()

  /**
   * What a fridge or a cupboard holds for dinner, offered as one-tap chips: the most used names are
   * baking powder and vanilla, which nobody plans dinner around. Only names the suggestions know show.
   */
  const QUICK: Record<string, string[]> = {
    en: ['tofu', 'chickpea', 'red lentil', 'rice', 'pasta', 'potato', 'sweet potato', 'onion', 'garlic', 'tomato', 'spinach', 'carrot', 'bell pepper', 'zucchini', 'mushroom', 'broccoli', 'cauliflower', 'coconut milk', 'black bean', 'lemon', 'avocado', 'tempeh', 'quinoa', 'peanut butter', 'kale', 'eggplant', 'ginger'],
    it: ['tofu', 'ceci', 'lenticchie rosse', 'riso', 'pasta', 'patate', 'patate dolci', 'cipolle', 'aglio', 'pomodori', 'spinaci', 'carote', 'peperoni', 'zucchine', 'funghi', 'broccoli', 'latte di cocco', 'fagioli neri', 'limoni', 'avocado', 'tempeh', 'quinoa', 'burro di arachidi', 'cavolo riccio', 'melanzane', 'zenzero']
  }

  let typed = $state('')
  let names = $state<{ name: string; lower: string }[]>([])
  loadSuggestions(pageLocale.code).then((list) => (names = list.map((name) => ({ name, lower: name.toLowerCase() }))))
  const chosen = $derived(new Set(fridge.items))
  const known = $derived(new Set(names.map((n) => n.lower)))
  const quick = $derived((QUICK[pageLocale.code] ?? QUICK.en!).filter((name) => known.has(name)))
  const others = $derived(fridge.items.filter((item) => !quick.includes(item)))

  // How many recipes the fridge makes with the cook's other filters: the button says it before the tap.
  let count = $state<number | null>(null)
  latest(
    () => {
      if (!fridge.items.length) return void (count = null)
      return catalog.counts([$state.snapshot(toQuery([], { ...filters, saved: false, fromFridge: true }))])
    },
    ([n]) => (count = n ?? null),
    () => (count = null)
  )

  function add(text: string) {
    setFridge([...fridge.items, ...text.split(',')])
    typed = ''
  }
  function toggle(name: string) {
    const lower = name.toLowerCase()
    setFridge(chosen.has(lower) ? fridge.items.filter((x) => x !== lower) : [...fridge.items, lower])
  }
  function submit(e: SubmitEvent) {
    e.preventDefault()
    add(typed)
  }
  /** Cook from it: the catalog shows what the fridge can make. */
  function cook(dialog: HTMLDialogElement | null) {
    if (typed.trim()) add(typed)
    filters.fromFridge = fridge.items.length > 0
    closeSheet(dialog)
  }
  // Text typed but not added still goes in the fridge.
  function closed() {
    if (typed.trim()) add(typed)
    if (!fridge.items.length) filters.fromFridge = false
    onclose()
  }
</script>

<dialog use:sheet class="sheet fridge-sheet" aria-labelledby="fridge-title" onclose={closed}>
  <div class="sheet-body">
    <div class="sheet-top"><button class="close" onclick={(e) => closeSheet(e.currentTarget.closest('dialog'))} aria-label={m.close()}><Icon name="close" size={20} /></button></div>
    <h2 id="fridge-title">{m.fridge_title()}</h2>
    <p class="hint" id="fridge-hint">{m.fridge_hint()}</p>

    <form class="field" onsubmit={submit}>
      <label class="visually-hidden" for="fridge-input">{m.fridge_add_label()}</label>
      <div class="input-row">
        <IngredientField id="fridge-input" bind:value={typed} {names} {chosen} placeholder={m.include_example()} describedby="fridge-hint" onfocus={() => {}} onpick={add} />
        {#if typed.trim()}<button class="btn-sm">{m.add()}</button>{/if}
      </div>
    </form>

    <!-- The quick chips show their own state; the rest of the fridge lists here. -->
    {#if others.length}
      <h3 class="fridge-head">{m.fridge_also()}</h3>
      <ul class="chips fridge-chips" aria-label={m.fridge_also()}>
        {#each others as item (item)}
          <li><button class="chip have" onclick={() => toggle(item)} aria-label={m.remove({ label: item })}>{item} <Icon name="close" size={12} /></button></li>
        {/each}
      </ul>
    {/if}

    {#if quick.length}
      <h3 class="fridge-head">{m.fridge_quick()}</h3>
      <div class="quick-grid">
        {#each quick as name (name)}
          <button class="pill outline" class:on={chosen.has(name)} aria-pressed={chosen.has(name)} onclick={() => toggle(name)}>{name}</button>
        {/each}
      </div>
    {/if}

    <div class="sheet-footer">
      {#if fridge.items.length}<button class="text-btn" onclick={() => setFridge([])}>{m.fridge_empty()}</button>{/if}
      <button class="cta" class:none={!fridge.items.length && !typed.trim()} disabled={!fridge.items.length && !typed.trim()} onclick={(e) => cook(e.currentTarget.closest('dialog'))}>
        <Icon name="fridge" size={18} /> {count === null || typed.trim() ? m.fridge_cook() : m.fridge_cook_count(countArgs(count))}
      </button>
    </div>
  </div>
</dialog>
