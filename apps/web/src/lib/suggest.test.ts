import { describe, expect, it } from 'vitest'
import { fuzzyPrefix, oneEditApart, suggestNames } from './suggest'

describe('oneEditApart', () => {
  it('allows the same string, one substitute, insert or delete', () => {
    expect(oneEditApart('tofu', 'tofu')).toBe(true)
    expect(oneEditApart('tofu', 'topu')).toBe(true)
    expect(oneEditApart('tofu', 'tof')).toBe(true)
    expect(oneEditApart('tof', 'tofu')).toBe(true)
    expect(oneEditApart('tofu', 'bean')).toBe(false)
  })
})

describe('fuzzyPrefix', () => {
  it('matches a one-typo prefix from four characters up', () => {
    expect(fuzzyPrefix('tomato', 'tomao')).toBe(true)
    expect(fuzzyPrefix('chickpea', 'chicpea')).toBe(true)
    expect(fuzzyPrefix('tomato', 'tom')).toBe(false)
    expect(fuzzyPrefix('tofu', 'tom')).toBe(false)
    expect(fuzzyPrefix('tomato', 'xyz')).toBe(false)
  })
})

describe('suggestNames', () => {
  const names = [
    { name: 'Tomato', lower: 'tomato' },
    { name: 'Tofu', lower: 'tofu' },
    { name: 'Sun-dried tomato', lower: 'sun-dried tomato' }
  ]

  it('prefers exact prefixes, then substrings, then fuzzy', () => {
    expect(suggestNames(names, 'tom', new Set()).map((h) => h.name)).toEqual(['Tomato', 'Sun-dried tomato'])
    expect(suggestNames(names, 'tomao', new Set()).map((h) => h.name)).toEqual(['Tomato'])
    expect(suggestNames(names, 'tofu', new Set(['tofu']))).toEqual([])
  })
})
