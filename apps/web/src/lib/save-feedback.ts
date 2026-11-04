/** Celebrate an explicit save, never a restored favorite or an unsave. */
export function saveFeedback(button: HTMLButtonElement) {
  let pulse: Animation | undefined
  const onclick = () => {
    pulse?.cancel()
    button.classList.remove('saving')
    if (button.getAttribute('aria-pressed') !== 'false' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const icon = button.querySelector('.icon')
    if (!icon) return
    pulse = icon.animate([
      { scale: 1, offset: 0, easing: 'ease-in' },
      { scale: 0.75, offset: 0.18, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      { scale: 1.4, offset: 0.55, easing: 'ease-in-out' },
      { scale: 1, offset: 1 }
    ], { duration: 440 })
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
