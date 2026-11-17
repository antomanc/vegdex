import { flushSync } from 'svelte'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { flash, settled } from './timing.svelte'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function mountFlash(ms: number) {
  let f!: ReturnType<typeof flash>
  const stop = $effect.root(() => {
    f = flash(ms)
  })
  flushSync()
  return { f, stop }
}

test('flash turns itself off after the last show', () => {
  const { f, stop } = mountFlash(2000)
  f.show()
  expect(f.on).toBe(true)
  vi.advanceTimersByTime(1500)
  f.show()
  vi.advanceTimersByTime(1500)
  expect(f.on).toBe(true)
  vi.advanceTimersByTime(500)
  expect(f.on).toBe(false)
  stop()
})

test('flash hide turns it off and cancels the pending timer', () => {
  const { f, stop } = mountFlash(2000)
  f.show()
  f.hide()
  expect(f.on).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  stop()
})

test('flash leaves no timer running after teardown', () => {
  const { f, stop } = mountFlash(2000)
  f.show()
  stop()
  expect(vi.getTimerCount()).toBe(0)
})

test('two flashes are independent', () => {
  const a = mountFlash(1000)
  const b = mountFlash(1000)
  a.f.show()
  expect(b.f.on).toBe(false)
  a.stop()
  b.stop()
})

function mountSettled(ms: number) {
  const source = $state({ value: 'a' })
  let s!: ReturnType<typeof settled<string>>
  const stop = $effect.root(() => {
    s = settled(() => source.value, ms, '')
  })
  flushSync()
  const set = (value: string) => {
    source.value = value
    flushSync()
  }
  return { s, set, stop }
}

test('settled holds the initial value until the source stops changing', () => {
  const { s, set, stop } = mountSettled(300)
  expect(s.current).toBe('')
  vi.advanceTimersByTime(200)
  set('ab')
  vi.advanceTimersByTime(200)
  expect(s.current).toBe('')
  vi.advanceTimersByTime(100)
  expect(s.current).toBe('ab')
  stop()
})

test('settled stops updating and leaves no timer after teardown', () => {
  const { s, set, stop } = mountSettled(300)
  set('abc')
  stop()
  expect(vi.getTimerCount()).toBe(0)
  vi.advanceTimersByTime(300)
  expect(s.current).toBe('')
})
