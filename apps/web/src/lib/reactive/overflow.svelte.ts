/** Reports whether a scrollable row still has content off-screen to its left or right. */
export function overflow(
  target: () => HTMLElement | null | undefined,
  onSides: (sides: { prev: boolean; next: boolean }) => void
): void {
  $effect(() => {
    const el = target()
    if (!el) return
    const sync = () => onSides({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    sync()
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  })
}
