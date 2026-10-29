import { describe, expect, it } from 'vitest';
import { lookupConcept, parseIngredient } from '../src';

const names = { chickpea: 'c001', chickpeas: 'c001', ceci: 'c001', garbanzo: 'c001' };

describe('ingredient concepts', () => {
  it('resolves exact multilingual aliases and retains the published line and measures', () => {
    expect(lookupConcept('CECI', names)).toBe('c001');
    expect(lookupConcept('garbanzo', names)).toBe('c001');
    expect(parseIngredient('400 g chickpeas, drained and rinsed', names)).toMatchObject({
      raw: '400 g chickpeas, drained and rinsed', quantity: 400, unit: 'g',
      name: 'chickpea', concept: 'c001', note: 'drained and rinsed'
    });
  });
  it('keeps qualified ingredients distinct and never guesses an unknown qualified name', () => {
    const lookup = { butter: 'animal-butter', milk: 'animal-milk', parmesan: 'animal-parmesan',
      'vegan butter': 'plant-butter', 'plant milk': 'plant-milk', 'vegan parmesan': 'plant-parmesan' };
    expect(parseIngredient('2 tbsp vegan butter', lookup).concept).toBe('plant-butter');
    expect(parseIngredient('1 cup plant milk', lookup).concept).toBe('plant-milk');
    expect(parseIngredient('1 tbsp vegan parmesan', lookup).concept).toBe('plant-parmesan');
    for (const name of ['mystery vegan butter', 'butter (vegan)', 'milk (plant-based)', 'dairy-free parmesan', 'non-dairy butter', 'vegan fancy parmesan', 'vegan, butter']) {
      expect(parseIngredient(`1 cup ${name}`, lookup).concept, name).toBeNull();
      expect(lookupConcept(name, lookup), name).toBeNull();
    }
  });
});

it('adds exact concepts to text matching without mapping qualified plants to animal concepts', async () => {
  const { searchRecipes } = await import('../src');
  const base = { id: 'plant', title: 'Dinner', source: 'vegan', url: '', image: null, minutes: 10, servings: 2, rating: null, ratingCount: null, calories: null, protein: null, published: null, tags: [] };
  const recipes = [
    { ...base, ing: ['vegan butter'], concepts: ['plant-butter'] },
    { ...base, id: 'animal', ing: ['butter'], concepts: ['animal-butter'] }
  ];
  const lookup = { butter: 'animal-butter', burro: 'animal-butter', 'vegan butter': 'plant-butter', 'burro vegano': 'plant-butter' };
  expect(searchRecipes(recipes, { include: ['burro vegano'] }, lookup).map((r) => r.id)).toEqual(['plant']);
  expect(searchRecipes(recipes, { include: ['burro'] }, lookup).map((r) => r.id)).toEqual(['animal']);
  // English words keep matching every ingredient name containing them, as before concepts.
  expect(searchRecipes(recipes, { include: ['butter'] }, lookup).map((r) => r.id)).toEqual(['plant', 'animal']);
  expect(searchRecipes(recipes, { exclude: ['butter'] }, lookup)).toEqual([]);
  expect(searchRecipes(recipes, { text: 'mystery vegan butter' }, lookup)).toEqual([]);
});

it('preserves English text matching for unmapped names alongside concept filters and title ranking', async () => {
  const { searchRecipes } = await import('../src');
  const base = { id: 'ingredient', title: 'Dinner', source: 'vegan', url: '', image: null, minutes: 20, servings: 2, rating: 5, ratingCount: 100, calories: null, protein: null, published: null, tags: [] };
  const recipes = [
    { ...base, ing: ['all-purpose flour', 'mystery seasoning'], concepts: [] },
    { ...base, id: 'title', title: 'Flour Dinner', rating: 4, ing: ['rice'], concepts: ['rice'] },
    { ...base, id: 'qualified', ing: ['mystery vegan flour'], concepts: [] }
  ];
  const lookup = { flour: 'flour', farina: 'flour', rice: 'rice' };
  expect(searchRecipes(recipes, { text: 'flour' }, lookup).map((r) => r.id)).toEqual(['title', 'ingredient', 'qualified']);
  expect(searchRecipes(recipes, { include: ['flour', 'mystery seasoning'], exclude: ['rice'] }, lookup).map((r) => r.id)).toEqual(['ingredient']);
  expect(searchRecipes(recipes, { text: 'mystery season' }, lookup).map((r) => r.id)).toEqual(['ingredient']);
  expect(searchRecipes(recipes, { text: 'dinner', maxMinutes: 10 }, lookup)).toEqual([]);
});

it('keeps Italian vegan qualifiers when an exact alias is missing', () => {
  const lookup = { burro: 'animal-butter', 'burro vegano': 'plant-butter', 'burro vegetale': 'plant-butter' };
  expect(parseIngredient('1 tbsp burro vegano', lookup).concept).toBe('plant-butter');
  expect(parseIngredient('1 tbsp burro (vegano)', lookup).concept).toBeNull();
  expect(parseIngredient('1 tbsp burro, vegetale', lookup).concept).toBeNull();
});

it('keeps English text matches for ingredients mapped to other concepts', async () => {
  const { searchRecipes } = await import('../src');
  const base = { id: 'olive', title: 'Dinner', source: 'vegan', url: '', image: null, minutes: 20, servings: 2, rating: null, ratingCount: null, calories: null, protein: null, published: null, tags: [] };
  const recipes = [
    { ...base, ing: ['olive oil', 'lemon juice'], concepts: ['olive-oil', 'lemon-juice'] },
    { ...base, id: 'coconut-sugar', ing: ['coconut sugar', 'oat'], concepts: ['coconut-sugar', 'oat'] },
    { ...base, id: 'coconut-milk', ing: ['coconut milk', 'black bean'], concepts: ['coconut-milk', 'black-bean'] },
    { ...base, id: 'plain', ing: ['oil', 'rice'], concepts: ['oil', 'rice'] }
  ];
  const lookup = { oil: 'oil', olio: 'oil', 'olive oil': 'olive-oil', coconut: 'coconut', 'coconut sugar': 'coconut-sugar',
    'coconut milk': 'coconut-milk', lemon: 'lemon', 'lemon juice': 'lemon-juice', bean: 'bean', 'black bean': 'black-bean' };
  const ids = (q: Parameters<typeof searchRecipes>[1]) => searchRecipes(recipes, q, lookup).map((r) => r.id).sort();
  expect(ids({ include: ['oil'] })).toEqual(['olive', 'plain']);
  expect(ids({ include: ['lemon'] })).toEqual(['olive']);
  expect(ids({ include: ['bean'] })).toEqual(['coconut-milk']);
  expect(ids({ text: 'oil' })).toEqual(['olive', 'plain']);
  expect(ids({ exclude: ['coconut'] })).toEqual(['olive', 'plain']);
  expect(ids({ include: ['oil'], exclude: ['lemon'] })).toEqual(['plain']);
  // Italian aliases still reach exactly their concept.
  expect(ids({ include: ['olio'] })).toEqual(['plain']);
});

it('gives "X or Y noun" the shared noun only when that names a known ingredient', () => {
  const lookup = { romano: 'cheese', 'romano pepper': 'sweet-pepper', quark: 'quark', 'nutritional yeast': 'yeast' };
  expect(parseIngredient('1 Romano or Ramiro pepper, diced finely', lookup).concept).toBe('sweet-pepper');
  expect(parseIngredient('1 cup quark or nutritional yeast', lookup).concept).toBe('quark');
});
