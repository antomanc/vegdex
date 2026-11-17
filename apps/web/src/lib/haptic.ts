/** Phone buzz for stall taps. Android Chrome supports it; iOS ignores it quietly. */

type Kind = 'tap' | 'select' | 'save' | 'open' | 'draw'

const patterns: Record<Kind, number | number[]> = {
  tap: 10,
  select: 14,
  save: [10, 36, 22],
  open: [12, 24, 18],
  draw: [16, 28, 16, 28, 22]
}

export function haptic(kind: Kind) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate?.(patterns[kind])
  } catch { /* no vibrator */ }
}

/** Light taps on signs, pills and crates; save / pick / open call haptic() themselves. */
export function listenForHaptics() {
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const el = event.target instanceof Element
      ? event.target.closest('button, a.cta, a.language-switch, .seg, .chip, .card-open')
      : null
    if (!(el instanceof HTMLElement) || el.closest('[disabled], [aria-disabled="true"]')) return
    if (el.matches('.heart, .save, .pick, .card-open')) return
    if (el.matches('.tab, .pill, .seg, .chip, .saved-toggle, .night, .language-switch')) haptic('select')
    else haptic('tap')
  }, { passive: true })
}
