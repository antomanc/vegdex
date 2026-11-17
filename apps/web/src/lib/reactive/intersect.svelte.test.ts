import { flushSync } from 'svelte'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { intersect } from './intersect.svelte'

class FakeObserver implements IntersectionObserver {
  static all: FakeObserver[] = []
  observed: Element[] = []
  connected = true
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds = []
  constructor(
    readonly report: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit
  ) {
    FakeObserver.all.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  disconnect() {
    this.connected = false
  }
  unobserve() {}
  takeRecords() {
    return []
  }
}

const live = () => FakeObserver.all.filter((o) => o.connected)

beforeEach(() => {
  FakeObserver.all = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

function setup(target: Element | null) {
  const s = $state({ target, margin: '0px' })
  const seen: IntersectionObserverEntry[][] = []
  const stop = $effect.root(() => {
    intersect(
      () => s.target,
      (entries) => seen.push(entries),
      () => ({ rootMargin: s.margin })
    )
  })
  flushSync()
  return { s, seen, stop }
}

test('observes the target and reports its entries', () => {
  const el = document.createElement('div')
  const { seen, stop } = setup(el)
  expect(live()).toHaveLength(1)
  expect(live()[0]!.observed).toEqual([el])
  const entries = [{ isIntersecting: true } as IntersectionObserverEntry]
  const observer = live()[0]!
  observer.report(entries, observer)
  expect(seen).toEqual([entries])
  stop()
})

test('waits for a target before observing', () => {
  const { s, stop } = setup(null)
  expect(FakeObserver.all).toHaveLength(0)
  s.target = document.createElement('div')
  flushSync()
  expect(live()).toHaveLength(1)
  stop()
})

test('a new target or new options replace the observer', () => {
  const { s, stop } = setup(document.createElement('div'))
  const next = document.createElement('section')
  s.target = next
  flushSync()
  expect(live()).toHaveLength(1)
  expect(live()[0]!.observed).toEqual([next])
  s.margin = '100px'
  flushSync()
  expect(live()).toHaveLength(1)
  expect(live()[0]!.options).toEqual({ rootMargin: '100px' })
  expect(FakeObserver.all).toHaveLength(3)
  stop()
})

test('teardown disconnects the observer', () => {
  const { stop } = setup(document.createElement('div'))
  stop()
  expect(live()).toHaveLength(0)
})
