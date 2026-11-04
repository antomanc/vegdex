/**
 * Bottom sheets open as modal dialogs and take one history entry, so the phone's back
 * gesture closes the sheet instead of leaving the app.
 */

const closers: (() => void)[] = []
let ownBacks = 0
let afterPop: () => void = () => {}

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
    { translate: style.translate, rotate: style.rotate, opacity: style.opacity },
    { translate: '0 24px', rotate: '-0.4deg', opacity: 0 }
  ], { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
  void exit.finished.then(() => {
    if (dialog.isConnected) dialog.close()
  }, () => {})
}

/** Svelte action for a sheet `<dialog>`: opens it, closes on backdrop tap and on back. */
export function sheet(dialog: HTMLDialogElement) {
  const close = () => closeSheet(dialog)
  history.pushState(history.state, '', location.href)
  closers.push(close)
  dialog.showModal()

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
      release()
    }
  }
}
