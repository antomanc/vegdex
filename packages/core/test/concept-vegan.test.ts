import { expect, it } from 'vitest';
import { findNonVegan, findNonVeganConcepts } from '../src';

it('reports an animal concept even when its English synonym passes the text check', () => {
  const lines = ['1 cup quark'];
  expect(findNonVegan(lines)).toEqual([]);
  expect(findNonVeganConcepts(lines, { quark: 'cheese' }, { cheese: 'no' })).toEqual([
    { concept: 'cheese', line: '1 cup quark' }
  ]);
});

const lookup = { quark: 'cheese', 'vegan butter': 'plant-butter', 'plant milk': 'plant-milk', 'vegan parmesan': 'plant-parmesan' };
const vegan = { cheese: 'no', 'plant-butter': 'yes', 'plant-milk': 'yes', 'plant-parmesan': 'yes' } as const;

it.each([
  '1 cup quark or vegan butter',
  '1 cup quark and vegan butter',
  '2 tbsp vegan butter and 1 cup quark',
  '2 tbsp vegan butter; 1 cup quark',
  '2 tbsp vegan butter, 1 cup quark',
  'vegan butter, quark',
  'quark, vegan butter',
  'quark with vegan butter',
  'quark (or vegan butter)'
])('does not let qualification of a separate ingredient or alternative excuse %s', (line) => {
  expect(findNonVeganConcepts([line], lookup, vegan)).toEqual([
    expect.objectContaining({ concept: 'cheese', line })
  ]);
});

it('accepts distinct plant concepts and leaves unmapped and uncertain English to the text check', () => {
  expect(findNonVeganConcepts([
    '2 tbsp vegan butter', '1 cup plant milk', '1 tbsp vegan parmesan',
    '1 tbsp mystery seasoning', '1 tsp rennet', '1 cup unclassified ingredient'
  ], { ...lookup, rennet: 'rennet', 'unclassified ingredient': 'unknown' }, { ...vegan, rennet: 'maybe', unknown: 'unknown' })).toEqual([]);
});

it('lets a plant qualifier on the same option excuse its concept, as the text check does', () => {
  expect(findNonVeganConcepts(['1 cup quark (i used soy quark)', '1 cup quark, i used vegan quark', '1 cup quark; dairy-free'], lookup, vegan)).toEqual([]);
});

it('keeps qualifiers on the primary option and ignores ingredient headings and note-only animal mentions', () => {
  expect(findNonVeganConcepts(['vegan butter or quark', 'salt (omit for quark)', 'For the quark filling'], lookup, vegan)).toEqual([]);
});
