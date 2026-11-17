import { describe, expect, it, vi } from 'vitest'
import { reloadIntoUpdates } from './app-update'

function setup({ controlled = true } = {}) {
  const container = new EventTarget() as EventTarget & { controller: object | null; getRegistration: () => Promise<{ update: () => Promise<void> } | undefined> }
  container.controller = controlled ? {} : null
  const update = vi.fn(() => Promise.resolve())
  container.getRegistration = () => Promise.resolve({ update })
  const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState; querySelector: (s: string) => Element | null }
  doc.visibilityState = 'visible'
  let sheetOpen = false
  doc.querySelector = () => (sheetOpen ? ({} as Element) : null)
  let time = 0
  const reload = vi.fn()
  reloadIntoUpdates({ container: container as never, doc: doc as never, reload, now: () => time })
  const back = () => {
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
  }
  return {
    reload, update, back,
    newVersion: () => container.dispatchEvent(new Event('controllerchange')),
    openSheet: (open: boolean) => (sheetOpen = open),
    wait: (ms: number) => (time += ms)
  }
}

describe('reloadIntoUpdates', () => {
  it('loads a version that took over while the app was open the next time the cook comes back', () => {
    const app = setup()
    app.newVersion()
    expect(app.reload).not.toHaveBeenCalled()
    app.back()
    expect(app.reload).toHaveBeenCalledOnce()
  })

  it('waits while a sheet is open, and reloads on a later return', () => {
    const app = setup()
    app.newVersion()
    app.openSheet(true)
    app.back()
    expect(app.reload).not.toHaveBeenCalled()
    app.openSheet(false)
    app.back()
    expect(app.reload).toHaveBeenCalledOnce()
  })

  it('never reloads for the first install', () => {
    const app = setup({ controlled: false })
    app.newVersion()
    app.back()
    expect(app.reload).not.toHaveBeenCalled()
  })

  it('asks for a new version on a return, at most every half hour', async () => {
    const app = setup()
    app.back()
    expect(app.update).not.toHaveBeenCalled()
    app.wait(31 * 60 * 1000)
    app.back()
    app.back()
    await Promise.resolve()
    await Promise.resolve()
    expect(app.update).toHaveBeenCalledOnce()
  })
})
