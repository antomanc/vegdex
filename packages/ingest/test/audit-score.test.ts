import { expect, it } from 'vitest';
import { parseLine } from '@vegdex/core';
import { changes, compare } from '../src/audit-score';

it('accepts a bracket weight as an amount match', () => {
  const line = { lang: 'en', line: '1 cup (240 g) flour', n: 1 };
  expect(compare(line, { i: 0, p: [{ q: 240, u: 'g' }] }, parseLine(line.line), 'flour', 'farina')).not.toContain('amount');
});

it.each(['nondairy milk', 'non-dairy milk', 'dairy free milk', 'hazelnut butter', 'sunflower seed butter', 'cocoa butter'])('accepts safe rendered %s', en => {
  const line = { lang: 'en', line: `vegan ${en}`, n: 1 };
  expect(compare(line, { i: 0, p: [{ en: line.line }] }, parseLine(line.line), en, '')).not.toContain('vegan');
});

it('flags a lost vegan qualifier even when kinds disagree', () => {
  const line = { lang: 'en', line: 'vegan mayo', n: 1 };
  expect(compare(line, { i: 0, k: 'h' }, parseLine(line.line), 'mayo', '')).toContain('vegan');
});

it('detects replacements even when flag counts stay equal', () => {
  expect(changes([1, 2], [2, 3])).toEqual({ fixed: [1], added: [3] });
});

it('distinguishes missing plus amounts from a preserved sum', () => {
  const line = { lang: 'en', line: '1 cup + 2 tbsp milk', n: 1 };
  const answer = { i: 0, p: [{ q: 1, u: 'cup', plus: { q: 2, u: 'tbsp' } }] };
  expect(compare(line, answer, parseLine('240 ml milk'), 'milk', '')).toContain('plus');
  expect(compare(line, answer, parseLine('270 ml milk'), 'milk', '')).not.toContain('plus');
});

it('separates hidden ingredient labels from prose shown as food', () => {
  const line = { lang: 'en', line: 'For serving:', n: 1 };
  expect(compare(line, { i: 0, p: [{ en: 'salt' }] }, parseLine(line.line), '', '')).toContain('label hides ingredients');
  expect(compare(line, { i: 0, k: 'o' }, parseLine('salt'), 'salt', '')).toContain('not an ingredient');
});
