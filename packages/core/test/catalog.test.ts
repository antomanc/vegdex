import { describe, expect, it } from 'vitest';
import { packCatalog, unpackCatalog, type Catalog, type CatalogRecipe } from '../src';

const recipe = (id: string, over: Partial<CatalogRecipe>): CatalogRecipe => ({
  id, title: id, source: 's', url: `https://example.com/${id}`, image: null, minutes: 20, servings: 4, rating: 4.5, ratingCount: 10,
  calories: null, protein: null, published: null, tags: ['meal:main', 'flavor:savory'], ing: ['garlic'], ...over
});
const catalog = (recipes: CatalogRecipe[]): Catalog => ({ version: 1, generatedAt: '2026-11-02T00:00:00.000Z', sources: [], recipes });

// Concept families as emit writes them: every concept with all of its ancestors, sorted.
const parents: Record<string, string[]> = {
  'black-bean': ['bean'], 'bean': ['legume'], 'chickpea': ['legume'], 'legume': [], 'garlic': [],
  'loop-a': ['loop-b'], 'loop-b': ['loop-a']
};

describe('packCatalog and unpackCatalog', () => {
  it('give back the catalog they packed, families included', () => {
    const original = catalog([
      recipe('a', { concepts: ['bean', 'black-bean', 'chickpea', 'legume'], ing: ['black beans', 'chickpeas'] }),
      recipe('b', { concepts: ['bean', 'legume'], tags: ['meal:soup'], ing: ['beans', 'garlic'] }),
      // Concepts that are each other's parents cannot be left for unpacking to find again.
      recipe('c', { concepts: ['garlic', 'loop-a', 'loop-b'] }),
      // Datasets from before concepts have none.
      recipe('legacy', {})
    ]);
    const packed = packCatalog(original, (id) => parents[id] ?? []);
    expect(unpackCatalog(packed)).toEqual(original);
    expect(unpackCatalog(JSON.parse(JSON.stringify(packed)))).toEqual(original);
  });

  it('ship each repeated string once and only the concepts the others do not imply', () => {
    const packed = packCatalog(catalog([
      recipe('a', { concepts: ['bean', 'black-bean', 'legume'], ing: ['garlic', 'black beans'] }),
      recipe('b', { concepts: ['bean', 'legume'], ing: ['garlic'] })
    ]), (id) => parents[id] ?? []);
    expect(packed.concepts).toEqual(['bean', 'black-bean', 'legume']);
    expect(packed.recipes.map((r) => r.concepts!.map((i) => packed.concepts[i]))).toEqual([['black-bean'], ['bean']]);
    expect(packed.names).toEqual(['black beans', 'garlic']);
    expect(packed.recipes.map((r) => r.ing)).toEqual([[1, 0], [1]]);
  });

  it('keep a concept list that leaves out an ancestor exactly as given', () => {
    // Emit always writes whole families; packing must still not add what a caller left out.
    const original = catalog([
      recipe('a', { concepts: ['bean'] }),
      recipe('b', { concepts: ['bean', 'black-bean', 'legume'] })
    ]);
    expect(unpackCatalog(packCatalog(original, (id) => parents[id] ?? []))).toEqual(original);
  });

  it('pass a catalog from before packing through unchanged', () => {
    const old = catalog([recipe('a', { concepts: ['garlic'] })]);
    expect(unpackCatalog(old)).toBe(old);
  });
});
