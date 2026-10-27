<script lang="ts">
  import Icon from './Icon.svelte'
  import { activeFilters, clearFilters, removeFilter } from './state.svelte'

  /** Hidden when the empty state already offers its own way out. */
  let { showClear = true }: { showClear?: boolean } = $props()

  const active = $derived(activeFilters())
</script>

{#if active.length}
  <ul class="active-filters" aria-label="Active filters">
    {#each active as f (f.label)}
      <li>
        <button class="chip" class:avoid={f.label.startsWith('no ')} onclick={() => removeFilter(f)} aria-label="Remove {f.label}">
          {f.label} <Icon name="close" size={12} />
        </button>
      </li>
    {/each}
    {#if showClear && active.length > 1}
      <li><button class="text-btn" onclick={clearFilters}>Clear all</button></li>
    {/if}
  </ul>
{/if}
