/**
 * Price-tag pendulum: a damped swing driven by the finger's horizontal speed.
 * Uses WAAPI keyframes (no rAF) so conventions stay clean and reduced-motion stays still.
 */

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'

function swing(node: HTMLElement, impulse: number) {
  const peak = Math.max(-18, Math.min(18, impulse * 55))
  for (const a of node.getAnimations()) a.cancel()
  node.animate(
    [
      { rotate: '0deg', offset: 0 },
      { rotate: `${peak}deg`, offset: 0.18, easing: ease },
      { rotate: `${-peak * 0.45}deg`, offset: 0.42 },
      { rotate: `${peak * 0.18}deg`, offset: 0.68 },
      { rotate: '0deg', offset: 1 }
    ],
    { duration: 920, easing: 'ease-out' }
  )
}

/** Svelte action: hang the red time tag so a brush or tap swings it on its string. */
export function tagPendulum(node: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return {}
  let lastX = 0
  let lastT = 0
  const card = node.closest('.card')

  const onDown = (e: Event) => {
    const p = e as PointerEvent
    lastX = p.clientX
    lastT = p.timeStamp
  }
  const onUp = (e: Event) => {
    const p = e as PointerEvent
    const dt = Math.max(8, p.timeStamp - lastT)
    const vx = (p.clientX - lastX) / dt
    // A tap with no drag still gives a small market nudge.
    swing(node, Math.abs(vx) < 0.02 ? (Math.random() > 0.5 ? 0.12 : -0.12) : vx)
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointerup', onUp)
  card?.addEventListener('pointerdown', onDown)
  card?.addEventListener('pointerup', onUp)

  return {
    destroy() {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointerup', onUp)
      card?.removeEventListener('pointerdown', onDown)
      card?.removeEventListener('pointerup', onUp)
    }
  }
}
