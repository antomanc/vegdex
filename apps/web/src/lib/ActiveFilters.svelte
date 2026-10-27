<script lang="ts">
  import Icon from './Icon.svelte'
  import { FREE, MEAL_LABELS } from './labels'
  import { clearFilters, filters } from './state.svelte'

  const meal = new Map(MEAL_LABELS)
  const free = new Map(FREE)
  const without = <T,>(list: T[], v: T) => list.filter((x) => x !== v)

  const active = $derived([
    ...(filters.flavor ? [{ label: filters.flavor === 'sweet' ? 'Sweet' : 'Savory', remove: () => (filters.flavor = null) }] : []),
    ...filters.meals.map((m) => ({ label: meal.get(m) ?? m, remove: () => (filters.meals = without(filters.meals, m)) })),
    ...(filters.maxMinutes ? [{ label: `≤ ${filters.maxMinutes} min`, remove: () => (filters.maxMinutes = null) }] : []),
    ...(filters.highProtein ? [{ label: 'High protein', remove: () => (filters.highProtein = false) }] : []),
    ...filters.freeFrom.map((f) => ({ label: free.get(f) ?? f, remove: () => (filters.freeFrom = without(filters.freeFrom, f)) })),
    ...filters.include.map((v) => ({ label: `with ${v}`, remove: () => (filters.include = without(filters.include, v)) })),
    ...filters.exclude.map((v) => ({ label: `no ${v}`, remove: () => (filters.exclude = without(filters.exclude, v)) }))
  ])
</script>

{#if active.length}
  <ul class="active-filters" aria-label="Active filters">
    {#each active as f (f.label)}
      <li><button class="chip" onclick={f.remove} aria-label="Remove {f.label}">{f.label} <Icon name="close" size={12} /></button></li>
    {/each}
    {#if active.length > 1}
      <li><button class="text-btn" onclick={clearFilters}>Clear all</button></li>
    {/if}
  </ul>
{/if}
