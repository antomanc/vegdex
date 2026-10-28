<script lang="ts">
  import { prefs, setUnits } from './state.svelte'

  const UNITS = [['us', 'US'], ['metric', 'Metric']] as const
</script>

<div class="segmented units" role="group" aria-label="Units">
  {#each UNITS as [units, label] (units)}
    <button class="seg" class:on={prefs.units === units} aria-pressed={prefs.units === units} onclick={() => setUnits(units)}>{label}</button>
  {/each}
</div>
