import { flushSync } from 'svelte'
import { afterEach, expect, test, vi } from 'vitest'
import { onlineStatus } from './online.svelte'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('onlineStatus follows online and offline events', () => {
  let onLine = true
  vi.stubGlobal('navigator', {
    get onLine() {
      return onLine
    }
  })
  let net!: ReturnType<typeof onlineStatus>
  const stop = $effect.root(() => {
    net = onlineStatus()
  })
  flushSync()
  expect(net.online).toBe(true)

  onLine = false
  dispatchEvent(new Event('offline'))
  flushSync()
  expect(net.online).toBe(false)

  onLine = true
  dispatchEvent(new Event('online'))
  flushSync()
  expect(net.online).toBe(true)

  stop()
})
