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

/** Svelte action for a sheet `<dialog>`: opens it, closes on backdrop tap and on back. */
export function sheet(dialog: HTMLDialogElement) {
  const close = () => dialog.close()
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
  dialog.addEventListener('close', release)
  dialog.addEventListener('click', onclick)
  return {
    destroy() {
      dialog.removeEventListener('close', release)
      dialog.removeEventListener('click', onclick)
      release()
    }
  }
}
