/** Reports when the element `target` returns crosses the viewport, with fresh options whenever they change. */
export function intersect(
  target: () => Element | null | undefined,
  onEntries: (entries: IntersectionObserverEntry[]) => void,
  options: () => IntersectionObserverInit = () => ({})
): void {
  $effect(() => {
    const el = target()
    if (!el) return
    const observer = new IntersectionObserver(onEntries, options())
    observer.observe(el)
    return () => observer.disconnect()
  })
}
