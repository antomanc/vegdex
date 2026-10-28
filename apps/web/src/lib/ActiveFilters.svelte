<script lang="ts">
  import { m } from './i18n'
  import Icon from './Icon.svelte'
  import { activeFilters, clearFilters, removeFilter } from './state.svelte'

  /** Hidden when the empty state already offers its own way out. */
  let { showClear = true }: { showClear?: boolean } = $props()

  const active = $derived(activeFilters())
</script>

{#if active.length}
  <ul class="active-filters" aria-label={m.active_filters()}>
    {#each active as f (f.label)}
      <li>
        <button class="chip" class:avoid={!!f.patch.exclude} onclick={() => removeFilter(f)} aria-label={m.remove({ label: f.label })}>
          {f.label} <Icon name="close" size={12} />
        </button>
      </li>
    {/each}
    {#if showClear && active.length > 1}
      <li><button class="text-btn" onclick={clearFilters}>{m.clear_all()}</button></li>
    {/if}
  </ul>
{/if}
