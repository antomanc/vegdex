import { expect, it } from 'vitest';
import { findNonVegan, findNonVeganConcepts, parseIngredient } from '../src';

it('parses Italian decimal quantities and units without translating original text', () => {
  const line = '1,5 cucchiai di olio di oliva, per servire';
  const p = parseIngredient(line, { 'olio di oliva': 'olive-oil' }, 'it');
  expect(p).toMatchObject({ raw: line, quantity: 1.5, unit: 'tbsp', name: 'olio di oliva', concept: 'olive-oil', conceptExact: true, note: 'per servire' });
});

it('keeps Italian vegan-qualified concepts distinct and checks separate animal ingredients', () => {
  const lookup = { 'burro vegetale': 'vegan-butter', burro: 'butter', 'nome animale': 'animal' };
  expect(parseIngredient('due cucchiaini di burro vegetale', lookup, 'it')).toMatchObject({ concept: 'vegan-butter', quantity: 2, unit: 'tsp' });
  expect(parseIngredient('1 g burro vegetale sconosciuto', lookup, 'it').concept).toBeNull();
  expect(findNonVegan(['2 uova', '1 cucchiaio burro vegetale e 1 uovo', '100 ml latte di soia', '10 g parmigiano vegano'], 'it').map((h) => h.line)).toEqual(['2 uova', '1 cucchiaio burro vegetale e 1 uovo']);
  expect(findNonVeganConcepts(['10 g nome animale'], lookup, { animal: 'no' }, 'it')).toEqual([{ concept: 'animal', line: '10 g nome animale' }]);
});

it('retains Italian preparation and taste notes without making headings into purchases', () => {
  const lookup = { ceci: 'chickpea', sale: 'salt' };
  expect(parseIngredient('200 grammi di ceci cotti, scolati', lookup, 'it')).toMatchObject({ concept: 'chickpea', quantity: 200, unit: 'g', note: 'cotti, scolati' });
  expect(parseIngredient('sale q.b.', lookup, 'it')).toMatchObject({ name: 'sale', concept: 'salt', quantity: null, note: 'q.b.' });
  expect(parseIngredient('Per servire: crostini', lookup, 'it').name).toBe('');
});
