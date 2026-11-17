/**
 * Bottom sheets open as modal dialogs and take one history entry, so the phone's back
 * gesture closes the sheet instead of leaving the app.
 */

import { haptic } from './haptic'

const closers: (() => void)[] = []
let ownBacks = 0
let tappedCard: DOMRect | undefined
let tappedThumb: HTMLElement | undefined
let openThumb: HTMLElement | undefined

const VT = 'crate-photo'
const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'

// iOS does not always focus a tapped button; capture the card and its photo before Svelte opens its sheet.
document.addEventListener('click', (event) => {
  const card = event.target instanceof Element ? event.target.closest('.card-open')?.closest('.card') : null
  tappedCard = card?.getBoundingClientRect()
  tappedThumb = card?.querySelector<HTMLElement>('.thumb img:not(.placeholder)') ?? undefined
  if (card) haptic('open')
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

function still() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fade sheet chrome in alongside the crate morph — never after it was already visible. */
function settleContents(dialog: HTMLDialogElement) {
  const parts = dialog.querySelectorAll<HTMLElement>(
    '.sheet-top, .recipe-head > :not(.hero), .recipe-ingredients, .sheet-footer'
  )
  parts.forEach((part, i) => {
    part.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 240, delay: i * 28, easing: ease, fill: 'both' }
    )
  })
}

function morphOpen(dialog: HTMLDialogElement, origin: DOMRect | undefined) {
  const target = dialog.getBoundingClientRect()
  const from = origin
    ? `translate(${origin.x + origin.width / 2 - target.x - target.width / 2}px, ${origin.y + origin.height / 2 - target.y - target.height / 2}px) scale(${Math.max(0.38, Math.min(0.72, origin.width / target.width))})`
    : 'translateY(36%) scale(0.92)'
  dialog.animate(
    [
      { transform: from, opacity: 0.25 },
      { transform: 'none', opacity: 1 }
    ],
    { duration: 360, easing: ease }
  )
  try {
    dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out', pseudoElement: '::backdrop' })
  } catch { /* optional */ }
  settleContents(dialog)
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
  if (still()) {
    dialog.close()
    openThumb = undefined
    return
  }

  const hero = dialog.querySelector<HTMLElement>('.hero')
  const thumb = openThumb
  // Shared-element return: the crate photo flies back onto the stall when the browser can.
  if (dialog.matches('.recipe-sheet') && document.startViewTransition && hero && thumb?.isConnected) {
    dialog.classList.add('closing', 'vt-photo')
    document.documentElement.classList.add('vt-crate')
    hero.style.viewTransitionName = VT
    const run = document.startViewTransition(() => {
      hero.style.viewTransitionName = ''
      thumb.style.viewTransitionName = VT
      dialog.close()
    })
    void run.finished.finally(() => {
      thumb.style.viewTransitionName = ''
      document.documentElement.classList.remove('vt-crate')
      openThumb = undefined
    })
    return
  }

  dialog.classList.add('closing')
  const style = getComputedStyle(dialog)
  const exit = dialog.animate([
    { translate: style.translate, rotate: style.rotate, transform: style.transform, opacity: style.opacity },
    { translate: '0 48px', rotate: '-1.2deg', transform: 'scale(0.94)', opacity: 0 }
  ], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
  try {
    dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', pseudoElement: '::backdrop', fill: 'forwards' })
  } catch { /* optional */ }
  void exit.finished.then(() => {
    if (dialog.isConnected) dialog.close()
    openThumb = undefined
  }, () => {})
}

/** Svelte action for a sheet `<dialog>`: opens it, closes on backdrop tap and on back. */
export function sheet(dialog: HTMLDialogElement) {
  const close = () => closeSheet(dialog)
  const origin = tappedCard ?? document.activeElement?.closest('.card')?.getBoundingClientRect()
  const thumb = tappedThumb
  tappedCard = undefined
  tappedThumb = undefined
  openThumb = thumb
  const unlock = lockPageScroll()
  history.pushState(history.state, '', location.href)
  closers.push(close)

  const openPlain = () => {
    dialog.showModal()
    if (dialog.matches('.recipe-sheet') && !still()) morphOpen(dialog, origin)
  }

  // Shared-element open: only the crate photo morphs; sheet chrome stays hidden until it lands.
  if (dialog.matches('.recipe-sheet') && !still() && document.startViewTransition && thumb?.isConnected) {
    try {
      dialog.classList.add('vt-photo')
      document.documentElement.classList.add('vt-crate')
      thumb.style.viewTransitionName = VT
      const run = document.startViewTransition(() => {
        thumb.style.viewTransitionName = ''
        dialog.showModal()
        const hero = dialog.querySelector<HTMLElement>('.hero')
        if (hero) hero.style.viewTransitionName = VT
      })
      // Reveal chrome as soon as the morph is underway — waiting for finished felt too slow.
      void run.ready.then(() => {
        if (!dialog.open || still()) return
        settleContents(dialog)
        dialog.classList.remove('vt-photo')
      }).catch(() => {})
      void run.finished.finally(() => {
        const hero = dialog.querySelector<HTMLElement>('.hero')
        if (hero) hero.style.viewTransitionName = ''
        document.documentElement.classList.remove('vt-crate')
        dialog.classList.remove('vt-photo')
      })
    } catch {
      thumb.style.viewTransitionName = ''
      document.documentElement.classList.remove('vt-crate')
      dialog.classList.remove('vt-photo')
      openPlain()
    }
  } else {
    openPlain()
  }

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
      document.documentElement.classList.remove('vt-crate')
      dialog.classList.remove('vt-photo')
      unlock()
      release()
      openThumb = undefined
    }
  }
}
