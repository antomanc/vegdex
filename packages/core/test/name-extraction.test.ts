import { expect, it } from 'vitest';
import { parseIngredient } from '../src';

const lookup = { water: 'water', 'olive oil': 'oil', 'vegan mozzarella cheese': 'vegan-cheese', mozzarella: 'animal-cheese', 'smoked tofu': 'smoked-tofu', tofu: 'tofu', 'oil for frying': 'frying-oil' };

it.each([
  ['Water to knead', 'water', 'to knead'],
  ['1 tablespoon olive oil for brushing crust', 'oil', 'for brushing crust'],
  ['1 cup vegan mozzarella cheese for topping', 'vegan-cheese', 'for topping'],
  ['200 g smoked tofu for the filling', 'smoked-tofu', 'for the filling']
])('keeps purpose commentary and the specific product: %s', (line, concept, note) => {
  const p = parseIngredient(line, lookup);
  expect(p.concept).toBe(concept);
  expect(p.conceptExact).toBe(true);
  expect(p.note).toContain(note);
});

it('looks up the whole phrase before removing a purpose', () => {
  expect(parseIngredient('1 tablespoon oil for frying', lookup).concept).toBe('frying-oil');
});

it.each(['vegan mozzarella', 'plant-based mozzarella', 'dairy-free mozzarella', 'no-chicken broth', 'unsalted tofu', 'dried tofu', 'canned tofu'])('never drops buying qualifiers: %s', name => {
  expect(parseIngredient('1 cup '+name+' for topping', lookup).conceptExact).toBe(false);
});

it.each(['for topping and powdered sugar', 'for pasta plus salt', 'for topping: sesame', 'for 1 hour'])('keeps ingredient-bearing or timed suffixes: %s', suffix => {
  expect(parseIngredient('water '+suffix, lookup).phrase).toBe('water '+suffix);
});

it('keeps recipe-dependent amounts attached to their purpose', () => {
  const line = '1 cup water for pressure cooking, or 2 cups water for saucepan';
  expect(parseIngredient(line, lookup).phrase).toBe('water for pressure cooking');
  expect(parseIngredient('dough for one loaf', { dough: 'dough' }).phrase).toBe('dough for one loaf');
});
