<script lang="ts">
  let { name, size = 18, filled = false }: { name: 'heart' | 'close' | 'star' | 'external'; size?: number; filled?: boolean } = $props()
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
  fill={filled ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'heart'}
    <path d="M12 20.5s-7.5-4.4-9.2-9.3C1.7 7.9 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.4 0 5.6 3.4 4.5 6.7-1.7 4.9-9.2 9.3-9.2 9.3z" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'star'}
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  {:else}
    <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  {/if}
</svg>
