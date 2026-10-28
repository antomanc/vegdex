<script lang="ts">
  type Name = 'heart' | 'close' | 'star' | 'external' | 'search' | 'sliders' | 'clock' | 'list' | 'shuffle'
  let { name, size = 18, filled = false }: { name: Name; size?: number; filled?: boolean } = $props()
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
  fill={filled ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'heart'}
    <path d="M12 20.5s-7.5-4.4-9.2-9.3C1.7 7.9 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.4 0 5.6 3.4 4.5 6.7-1.7 4.9-9.2 9.3-9.2 9.3z" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'star'}
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
  {:else if name === 'sliders'}
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
  {:else if name === 'list'}
    <path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" stroke-width="3" />
  {:else if name === 'shuffle'}
    <path d="M3.5 7h2.8c2.6 0 4 1.6 5.2 5s2.6 5 5.2 5h3.8M3.5 17h2.8c1.3 0 2.3-.4 3.1-1.2M14.4 8.2c.8-.8 1.8-1.2 3.1-1.2h3M18 4l3 3-3 3M18 14l3 3-3 3" />
  {:else}
    <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  {/if}
</svg>
