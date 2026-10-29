import { expect, it } from 'vitest';
import { parseIngredient, renderIngredient, type IngredientTables } from '../src/index';

const tables: IngredientTables = {
  names: { chickpea: 'ceci', flour: 'farina', salt: 'sale', butter: 'burro vegano', milk: 'latte vegetale' },
  notes: { 'drained and rinsed': 'scolati e sciacquati', sifted: 'setacciata', 'to taste': 'quanto basta' },
  units: { g: ['g', 'g'], kg: ['kg', 'kg'], ml: ['ml', 'ml'], l: ['l', 'l'], cup: ['tazza', 'tazze'], tbsp: ['cucchiaio', 'cucchiai'] }
};
const lookup = { chickpeas: 'chickpea', flour: 'flour', salt: 'salt', 'vegan butter': 'butter', 'plant milk': 'milk' };

it('renders a parsed ingredient with its quantity, concept and complete translated preparation note', () => {
  const parsed = parseIngredient('400 g chickpeas, drained and rinsed', lookup);
  expect(renderIngredient(parsed, tables, 'it', 'metric')).toEqual(['400 g', 'ceci, scolati e sciacquati']);
});

it('weighs parsed English ingredients before translating and preserves source grams and ranges', () => {
  expect(renderIngredient(parseIngredient('2 cups flour, sifted', lookup), tables, 'it', 'metric')).toEqual(['≈ 250 g', 'farina, setacciata']);
  expect(renderIngredient(parseIngredient('2 cups flour (280 g)', lookup), tables, 'it', 'metric')).toEqual(['280 g', 'farina']);
  expect(renderIngredient(parseIngredient('1–2 cups flour', lookup), tables, 'it', 'metric')).toEqual(['≈ 125–250 g', 'farina']);
  expect(renderIngredient(parseIngredient('1 1/2 tbsp flour', lookup), tables, 'it', 'us')).toEqual(['1,5 cucchiai', 'farina']);
  expect(renderIngredient(parseIngredient('salt to taste', lookup), tables, 'it', 'metric')).toEqual(['', 'sale, quanto basta']);
});

it('falls back completely for missing parts or unsafe names and notes', () => {
  const p = parseIngredient('400 g chickpeas, drained and rinsed', lookup);
  expect(renderIngredient(p, { ...tables, notes: {} }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(p, { ...tables, names: {} }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(p, { ...tables, units: {} }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(p, { ...tables, names: { chickpea: 'pollo' } }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(p, { ...tables, notes: { 'drained and rinsed': 'con latte' } }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(parseIngredient('2 tbsp vegan butter', lookup), tables, 'it', 'us')).toEqual(['2 cucchiai', 'burro vegano']);
  expect(renderIngredient(parseIngredient('1 cup plant milk', lookup), tables, 'it', 'us')).toEqual(['1 tazza', 'latte vegetale']);
  expect(renderIngredient(parseIngredient('2 cups mystery flour'), tables, 'it', 'metric')).toBeNull();
});

it('translates grocery names after synonym aggregation while keeping stable row keys and amounts', async () => {
  const { compileGroceryList, displayGroceryName } = await import('../src/index');
  const items = compileGroceryList([
    { recipeId: 'a', ingredients: ['400 g chickpeas'], multiplier: 1 },
    { recipeId: 'b', ingredients: ['200 g garbanzo'], multiplier: 0.5 }
  ], { lookup: { chickpeas: 'chickpea', garbanzo: 'chickpea' }, concepts: { chickpea: ['chickpea', 'beans & legumes'] } });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ name: 'chickpea', concept: 'chickpea', amounts: ['500 g'], recipeIds: ['a', 'b'] });
  expect(displayGroceryName(items[0]!, tables, 'it')).toBe('ceci');
  expect(displayGroceryName(items[0]!, { ...tables, names: { chickpea: 'pollo' } }, 'it')).toBe('chickpea');
});

it('keeps original lines when canonicalization discarded size, alternatives or optional wording', () => {
  for (const line of ['2 large carrots', '1 cup walnuts or almonds', '2 tbsp sugar optional', '1 block extra-firm tofu']) {
    const parsed = parseIngredient(line, { carrots: 'carrot', carrot: 'carrot', walnuts: 'walnut', walnut: 'walnut', sugar: 'sugar', tofu: 'tofu' });
    const complete = { ...tables, names: { ...tables.names, carrot: 'carota', walnut: 'noce', sugar: 'zucchero', tofu: 'tofu' }, units: { ...tables.units, block: ['panetto', 'panetti'] as [string, string] } };
    expect(renderIngredient(parsed, complete, 'it', 'metric'), line).toBeNull();
  }
});

it('retains originals for cached parsed data without proof that the source wording was preserved', () => {
  const { conceptExact: _, ...legacy } = parseIngredient('400 g chickpeas, drained and rinsed', lookup);
  expect(renderIngredient(legacy, tables, 'it', 'metric')).toBeNull();
});
