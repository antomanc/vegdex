import { flushSync } from 'svelte'
import { expect, test } from 'vitest'
import { latest } from './latest.svelte'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (e: Error) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

function setup(count: number) {
  const question = $state({ n: 0 })
  const asks = Array.from({ length: count }, () => deferred<string>())
  const applied: string[] = []
  const failures: string[] = []
  const stop = $effect.root(() => {
    latest(() => asks[question.n]!.promise, (v) => applied.push(v), (e) => failures.push(e.message))
  })
  flushSync()
  const ask = (n: number) => {
    question.n = n
    flushSync()
  }
  const settled = () => Promise.allSettled(asks.map((a) => a.promise))
  return { asks, applied, failures, stop, ask, settled }
}

test('an older answer that lands last is dropped', async () => {
  const t = setup(2)
  t.ask(1)
  t.asks[1]!.resolve('new')
  t.asks[0]!.resolve('old')
  await t.settled()
  expect(t.applied).toEqual(['new'])
  t.stop()
})

test('an older failure after a newer success is dropped', async () => {
  const t = setup(2)
  t.ask(1)
  t.asks[1]!.resolve('new')
  t.asks[0]!.reject(new Error('old request failed'))
  await t.settled()
  expect(t.applied).toEqual(['new'])
  expect(t.failures).toEqual([])
  t.stop()
})

test('a failure of the current question is reported', async () => {
  const t = setup(1)
  t.asks[0]!.reject(new Error('offline'))
  await t.settled()
  expect(t.failures).toEqual(['offline'])
  t.stop()
})

test('an answer that lands after teardown is dropped', async () => {
  const t = setup(1)
  t.stop()
  t.asks[0]!.resolve('late')
  await t.settled()
  expect(t.applied).toEqual([])
})
