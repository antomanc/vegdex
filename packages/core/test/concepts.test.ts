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

it('uses exact concepts for include and exclude without matching animal names to qualified plants', async () => {
  const { searchRecipes } = await import('../src');
  const base = { id: 'plant', title: 'Dinner', source: 'vegan', url: '', image: null, minutes: 10, servings: 2, rating: null, ratingCount: null, calories: null, protein: null, published: null, tags: [] };
  const recipes = [
    { ...base, ing: ['vegan butter'], concepts: ['plant-butter'] },
    { ...base, id: 'animal', ing: ['butter'], concepts: ['animal-butter'] }
  ];
  const lookup = { butter: 'animal-butter', burro: 'animal-butter', 'vegan butter': 'plant-butter', 'burro vegano': 'plant-butter' };
  expect(searchRecipes(recipes, { include: ['burro vegano'] }, lookup).map((r) => r.id)).toEqual(['plant']);
  expect(searchRecipes(recipes, { include: ['butter'] }, lookup).map((r) => r.id)).toEqual(['animal']);
  expect(searchRecipes(recipes, { exclude: ['butter'] }, lookup).map((r) => r.id)).toEqual(['plant']);
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
  expect(searchRecipes(recipes, { text: 'flour' }, lookup).map((r) => r.id)).toEqual(['title', 'ingredient']);
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
