/**
 * Stall physics: rummage crates (FLIP swaps) before a random pick.
 * Web Animations API only — no timers.
 */

import { haptic } from './haptic'

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** Visible crates trade places like produce being sorted, then Pick opens a recipe. */
export async function shuffleVisibleCrates(grid: Element | null = document.querySelector('.grid')) {
  if (!grid || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const cards = [...grid.querySelectorAll<HTMLElement>('.card')].slice(0, 12)
  if (cards.length < 2) return
  grid.classList.add('shuffling')
  haptic('draw')
  try {
    // Three crates swap with a neighbour (FLIP), then settle — a hand sorting the stall.
    const picks = cards.filter((_, i) => i % 2 === 0).slice(0, 3)
    await Promise.all(picks.map(async (card, i) => {
      const sibling = cards[cards.indexOf(card) + 1] ?? cards[i]
      if (!sibling || sibling === card) {
        return card.animate([
          { transform: 'translate(0,0) rotate(0)' },
          { transform: 'translate(0,-10px) rotate(-2deg)', offset: 0.4 },
          { transform: 'none' }
        ], { duration: 420, delay: i * 40, easing: ease }).finished.catch(() => {})
      }
      const a = card.getBoundingClientRect()
      const b = sibling.getBoundingClientRect()
      const dx = b.left - a.left
      const dy = b.top - a.top
      await Promise.all([
        card.animate([
          { transform: 'translate(0,0) rotate(0)' },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 14}px) rotate(-3deg) scale(1.04)`, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) rotate(2deg)` },
          { transform: 'translate(0,0) rotate(0)' }
        ], { duration: 520, delay: i * 36, easing: ease }).finished.catch(() => {}),
        sibling.animate([
          { transform: 'translate(0,0) rotate(0)' },
          { transform: `translate(${-dx * 0.5}px, ${-dy * 0.5 - 10}px) rotate(2.5deg) scale(1.03)`, offset: 0.45 },
          { transform: `translate(${-dx}px, ${-dy}px) rotate(-1.5deg)` },
          { transform: 'translate(0,0) rotate(0)' }
        ], { duration: 520, delay: i * 36, easing: ease }).finished.catch(() => {})
      ])
    }))
  } finally {
    grid.classList.remove('shuffling')
  }
}
