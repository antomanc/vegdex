import { flushSync } from 'svelte'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { overflow } from './overflow.svelte'

class FakeObserver {
  static all: FakeObserver[] = []
  connected = true
  observed: Element[] = []
  constructor(readonly report: () => void) {
    FakeObserver.all.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  disconnect() {
    this.connected = false
  }
  unobserve() {}
}

const live = () => FakeObserver.all.filter((o) => o.connected)

beforeEach(() => {
  FakeObserver.all = []
  vi.stubGlobal('ResizeObserver', FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

/** A fake row: everything fits when scrollWidth is no larger than clientWidth. */
function row(scrollLeft = 0, clientWidth = 600, scrollWidth = 600): HTMLElement {
  const el = document.createElement('div') as HTMLElement
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  return el
}

function setup(target: HTMLElement | null) {
  const s = $state({ target })
  const sides: { prev: boolean; next: boolean }[] = []
  const stop = $effect.root(() => {
    overflow(() => s.target, (answer) => sides.push(answer))
  })
  flushSync()
  return { s, sides, stop }
}

test('reports both sides quiet when the whole row fits', () => {
  const { sides, stop } = setup(row())
  expect(sides).toEqual([{ prev: false, next: false }])
  stop()
})

test('a row with content off-screen reports the side it can still scroll to', () => {
  const { sides, stop } = setup(row(0, 600, 1200))
  expect(sides.at(-1)).toEqual({ prev: false, next: true })
  stop()
})

test('scrolling the row re-reports the sides', () => {
  const el = row(0, 600, 1200)
  const { sides, stop } = setup(el)
  el.scrollLeft = 300
  el.dispatchEvent(new Event('scroll'))
  expect(sides.at(-1)).toEqual({ prev: true, next: true })
  el.scrollLeft = 1200
  el.dispatchEvent(new Event('scroll'))
  expect(sides.at(-1)).toEqual({ prev: true, next: false })
  stop()
})

test('a resize re-reports the sides', () => {
  const { sides, stop } = setup(row(0, 600, 1200))
  live()[0]!.report()
  expect(sides).toHaveLength(2)
  stop()
})

test('waits for the row before observing', () => {
  const { s, stop } = setup(null)
  expect(FakeObserver.all).toHaveLength(0)
  s.target = row(0, 600, 1200)
  flushSync()
  expect(live()).toHaveLength(1)
  stop()
})

test('teardown stops listening and observing', () => {
  const el = row(0, 600, 1200)
  const { sides, stop } = setup(el)
  stop()
  el.scrollLeft = 300
  el.dispatchEvent(new Event('scroll'))
  expect(sides).toHaveLength(1)
  expect(live()).toHaveLength(0)
})
