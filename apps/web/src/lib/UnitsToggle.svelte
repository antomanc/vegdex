<script lang="ts">
  import { m } from './i18n'
  import { prefs, setUnits } from './state.svelte'

  const UNITS = [['us', m.units_us()], ['metric', m.units_metric()]] as const
</script>

<div class="segmented units" role="group" aria-label={m.units()}>
  {#each UNITS as [units, label] (units)}
    <button class="seg" class:on={prefs.units === units} aria-pressed={prefs.units === units} onclick={() => setUnits(units)}>{label}</button>
  {/each}
</div>
