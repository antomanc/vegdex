<script lang="ts">
  import { tick } from 'svelte'

  // Native datalists rebuild their popup on every keystroke, which lags on phones: this list stays a few rows of plain DOM.
  const SHOWN = 5
  let {
    id,
    value = $bindable(),
    names,
    chosen,
    placeholder,
    describedby,
    onfocus,
    onpick
  }: {
    id: string
    value: string
    names: { name: string; lower: string }[]
    chosen: Set<string>
    placeholder: string
    describedby: string
    onfocus: () => void
    onpick: (name: string) => void
  } = $props()

  let input = $state<HTMLInputElement>()
  let open = $state(false)
  let active = $state(-1)

  // "tofu, spin" suggests for what is being typed now, after the last comma.
  const before = $derived(value.slice(0, value.lastIndexOf(',') + 1))
  const term = $derived(value.slice(before.length).trim().toLowerCase())
  const matches = $derived.by(() => {
    if (!term) return []
    const first: { name: string; at: number }[] = []
    const inside: { name: string; at: number }[] = []
    for (const { name, lower } of names) {
      const at = lower.indexOf(term)
      if (at < 0 || chosen.has(lower)) continue
      if (at === 0) {
        first.push({ name, at })
        if (first.length === SHOWN) break
      } else if (inside.length < SHOWN) inside.push({ name, at })
    }
    return [...first, ...inside].slice(0, SHOWN)
  })
  const showing = $derived(open && matches.length > 0)

  function pick(name: string) {
    onpick(`${before}${name}`)
    open = false
    active = -1
    input?.focus()
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'Escape' && showing) {
      // The list closes first; the sheet stays open.
      e.preventDefault()
      e.stopPropagation()
      open = false
      active = -1
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && matches.length) {
      e.preventDefault()
      open = true
      const step = e.key === 'ArrowDown' ? 1 : -1
      active = (active + step + matches.length + (active < 0 && step < 0 ? 1 : 0)) % matches.length
    } else if (e.key === 'Enter' && showing && active >= 0) {
      e.preventDefault()
      pick(matches[active]!.name)
    }
  }
  // Closing waits for the click in progress: the list going away moves whatever the pointer is on.
  function blurred() {
    setTimeout(() => {
      if (document.activeElement !== input) {
        open = false
        active = -1
      }
    }, 200)
  }
  // The keyboard covers the lower half of a phone: the field moves up so its list has room.
  async function focused() {
    onfocus()
    await tick()
    setTimeout(() => input?.scrollIntoView({ block: 'start', behavior: 'instant' }), 300)
  }
</script>

<div class="combo">
  <input
    {id}
    bind:this={input}
    bind:value
    {placeholder}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={showing}
    aria-controls="{id}-list"
    aria-activedescendant={showing && active >= 0 ? `${id}-option-${active}` : undefined}
    aria-describedby={describedby}
    autocomplete="off"
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
    enterkeyhint="done"
    onfocus={focused}
    onblur={blurred}
    oninput={() => { open = true; active = -1 }}
    onkeydown={keys}
  />
</div>
<ul class="suggestions" id="{id}-list" role="listbox" aria-label={placeholder} hidden={!showing}>
  {#if showing}
    {#each matches as { name, at }, i (name)}
      <!-- Pressing keeps focus in the field, so the keyboard stays up for the next ingredient. -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li id="{id}-option-{i}" role="option" aria-selected={i === active} class:active={i === active}
        onpointerdown={(e) => e.preventDefault()} onclick={() => pick(name)}>{name.slice(0, at)}<b>{name.slice(at, at + term.length)}</b>{name.slice(at + term.length)}</li>
    {/each}
  {/if}
</ul>
