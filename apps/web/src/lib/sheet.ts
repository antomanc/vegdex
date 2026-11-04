/**
 * Bottom sheets open as modal dialogs and take one history entry, so the phone's back
 * gesture closes the sheet instead of leaving the app.
 */

const closers: (() => void)[] = []
let ownBacks = 0
let tappedCard: DOMRect | undefined
// iOS does not always focus a tapped button; capture the card before Svelte opens its sheet.
document.addEventListener('click', (event) => {
  tappedCard = event.target instanceof Element ? event.target.closest('.card-open')?.getBoundingClientRect() : undefined
}, true)
let afterPop: () => void = () => {}

let scrollLocks = 0
let restorePage = () => {}

function lockPageScroll() {
  if (scrollLocks++ === 0) {
    const { scrollX: x, scrollY: y } = window
    const body = document.body
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width }
    document.documentElement.classList.add('sheet-open')
    Object.assign(body.style, { position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%' })
    restorePage = () => {
      Object.assign(body.style, previous)
      document.documentElement.classList.remove('sheet-open')
      window.scrollTo({ left: x, top: y, behavior: 'instant' })
    }
  }
  return () => { if (--scrollLocks === 0) restorePage() }
}

/** Called after back closes a sheet: the entry below holds an older URL, so rewrite it. */
export function onSheetPop(fn: () => void) {
  afterPop = fn
}

addEventListener('popstate', () => {
  if (ownBacks > 0) ownBacks--
  else closers.pop()?.()
  afterPop()
})

/** Keep the dialog modal until its exit finishes, then let close handlers release it. */
export function closeSheet(dialog: HTMLDialogElement | null) {
  if (!dialog?.open || dialog.classList.contains('closing')) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dialog.close()
    return
  }
  const style = getComputedStyle(dialog)
  dialog.classList.add('closing')
  const exit = dialog.animate([
    { translate: style.translate, rotate: style.rotate, transform: style.transform, opacity: style.opacity },
    { translate: '0 32px', rotate: '-0.7deg', transform: 'scale(0.97)', opacity: 0 }
  ], { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
  void exit.finished.then(() => {
    if (dialog.isConnected) dialog.close()
  }, () => {})
}

/** Svelte action for a sheet `<dialog>`: opens it, closes on backdrop tap and on back. */
export function sheet(dialog: HTMLDialogElement) {
  const close = () => closeSheet(dialog)
  const origin = tappedCard ?? document.activeElement?.closest('.card')?.getBoundingClientRect()
  tappedCard = undefined
  const unlock = lockPageScroll()
  history.pushState(history.state, '', location.href)
  closers.push(close)
  dialog.showModal()
  if (dialog.matches('.recipe-sheet') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const target = dialog.getBoundingClientRect()
    const from = origin
      ? `translate(${origin.x + origin.width / 2 - target.x - target.width / 2}px, ${origin.y + origin.height / 2 - target.y - target.height / 2}px) scale(${Math.max(0.42, Math.min(0.8, origin.width / target.width))}) rotate(-1.5deg)`
      : 'translateY(28%) scale(0.96) rotate(-1.5deg)'
    dialog.animate([
      { transform: from, opacity: 0.35 },
      { transform: 'none', opacity: 1 }
    ], { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
  }

  // Closed by the close button, Esc or the backdrop: drop the history entry it took.
  const release = () => {
    const i = closers.indexOf(close)
    if (i < 0) return
    closers.splice(i, 1)
    ownBacks++
    history.back()
  }
  const onclick = (e: MouseEvent) => {
    if (e.target === dialog) close()
  }
  const oncancel = (e: Event) => {
    e.preventDefault()
    close()
  }
  dialog.addEventListener('cancel', oncancel)
  dialog.addEventListener('close', release)
  dialog.addEventListener('click', onclick)
  return {
    destroy() {
      for (const animation of dialog.getAnimations()) animation.cancel()
      dialog.removeEventListener('cancel', oncancel)
      dialog.removeEventListener('close', release)
      dialog.removeEventListener('click', onclick)
      unlock()
      release()
    }
  }
}
