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
  const animal = ['50 g lardo', '100 g speck a cubetti', '2 würstel', '200 g polpo', '300 g baccalà', '1 cucchiaio di salsa worcestershire', '200 g frutti di mare', '1 sardina'];
  expect(findNonVegan([...animal, '150 g würstel vegani'], 'it').map((h) => h.line)).toEqual(animal);
  expect(findNonVeganConcepts(['10 g nome animale'], lookup, { animal: 'no' }, 'it')).toEqual([{ concept: 'animal', line: '10 g nome animale' }]);
});

it('retains Italian preparation and taste notes without making headings into purchases', () => {
  const lookup = { ceci: 'chickpea', sale: 'salt' };
  expect(parseIngredient('200 grammi di ceci cotti, scolati', lookup, 'it')).toMatchObject({ concept: 'chickpea', quantity: 200, unit: 'g', note: 'cotti, scolati' });
  expect(parseIngredient('sale q.b.', lookup, 'it')).toMatchObject({ name: 'sale', concept: 'salt', quantity: null, note: 'q.b.' });
  expect(parseIngredient('Per servire: crostini', lookup, 'it').name).toBe('');
  expect(parseIngredient('220 g ceci già cotti', lookup, 'it')).toMatchObject({ concept: 'chickpea', quantity: 220, unit: 'g' });
  expect(parseIngredient('1 vasetto di ceci ben sciacquati', lookup, 'it')).toMatchObject({ concept: 'chickpea', quantity: 1, unit: 'jar' });
  expect(parseIngredient('acqua qb per frullare', { acqua: 'water' }, 'it')).toMatchObject({ concept: 'water', quantity: null });
});

it('reads Italian packages, leaves and handfuls as units only after an amount', () => {
  const lookup = { 'lievito per dolci': 'baking-powder', salvia: 'sage', menta: 'mint', sale: 'salt' };
  expect(parseIngredient('Mezza bustina di lievito per dolci', lookup, 'it')).toMatchObject({ concept: 'baking-powder', quantity: 0.5, unit: 'sachet' });
  expect(parseIngredient('6-7 foglie di salvia', lookup, 'it')).toMatchObject({ concept: 'sage', quantity: 6, quantityMax: 7, unit: 'leaf' });
  expect(parseIngredient('Foglioline di menta', lookup, 'it')).toMatchObject({ unit: null, concept: null });
  expect(parseIngredient('Pizzico di sale', lookup, 'it')).toMatchObject({ concept: 'salt', unit: 'pinch' });
});
