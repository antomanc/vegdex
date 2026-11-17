import { haptic } from './haptic'

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** A heart flies from the crate to the Saved key, then the key pops. */
function flyToSaved(from: DOMRect) {
  const dock = document.querySelector('.saved-toggle')
  if (!dock) return
  const to = dock.getBoundingClientRect()
  const flyer = document.createElement('span')
  flyer.className = 'heart-flyer'
  flyer.setAttribute('aria-hidden', 'true')
  flyer.textContent = '♥'
  Object.assign(flyer.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2 - 10}px`,
    top: `${from.top + from.height / 2 - 10}px`,
    width: '20px',
    height: '20px',
    zIndex: '30',
    pointerEvents: 'none',
    color: 'var(--sign-red)',
    fontSize: '18px',
    lineHeight: '20px',
    textAlign: 'center'
  })
  document.body.append(flyer)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  void flyer
    .animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.4 - 28}px) scale(1.25)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.85, offset: 0.88 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 }
      ],
      { duration: 580, easing: ease }
    )
    .finished.then(() => flyer.remove(), () => flyer.remove())
  dock.animate([{ scale: 1 }, { scale: 1.14 }, { scale: 1 }], { duration: 320, easing: ease })
}

/** Celebrate an explicit save, never a restored favorite or an unsave. */
export function saveFeedback(button: HTMLButtonElement) {
  let pulse: Animation | undefined
  const onclick = () => {
    pulse?.cancel()
    button.classList.remove('saving')
    if (button.getAttribute('aria-pressed') !== 'false') return
    haptic('save')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const icon = button.querySelector('.icon')
    if (!icon) return
    flyToSaved(button.getBoundingClientRect())
    pulse = icon.animate(
      [
        { scale: 1, offset: 0, easing: 'ease-in' },
        { scale: 0.68, offset: 0.16, easing: ease },
        { scale: 1.65, offset: 0.52, easing: 'ease-in-out' },
        { scale: 0.92, offset: 0.78, easing: 'ease-out' },
        { scale: 1, offset: 1 }
      ],
      { duration: 560 }
    )
    button.classList.add('saving')
    void pulse.finished.then(() => button.classList.remove('saving'), () => {})
  }
  button.addEventListener('click', onclick, true)
  return {
    destroy() {
      pulse?.cancel()
      button.removeEventListener('click', onclick, true)
    }
  }
}
