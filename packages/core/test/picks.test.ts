import { describe, expect, it } from 'vitest';
import { mixPicks, picksOrder, picksSeed, searchRecipes, type CatalogRecipe } from '../src';

const r = (id: string, over: Partial<CatalogRecipe> = {}): CatalogRecipe => ({
  id, title: id, source: 'blog', url: 'u', image: null, minutes: 20, servings: 4, rating: 4.5, ratingCount: 10,
  calories: null, protein: null, published: null, tags: ['meal:main', 'flavor:savory'], ing: [], ...over
});
/** A recipe strong enough for the pool. */
const pictured = (id: string, over: Partial<CatalogRecipe> = {}) =>
  r(id, { image: `https://example.com/${id}.jpg`, rating: 4.8, ratingCount: 50, ...over });

const ids = (recipes: CatalogRecipe[]) => recipes.map((r) => r.id);

describe('picksSeed', () => {
  it('is the UTC day of the catalog emit', () => {
    expect(picksSeed('2026-11-05T23:30:00.000Z')).toBe('2026-11-05');
    expect(picksSeed('2026-11-06T00:30:00.000Z')).toBe('2026-11-06');
    expect(picksSeed('2026-11-05T23:30:00-05:00')).toBe('2026-11-06');
  });
});

describe('picksOrder', () => {
  const recipes = [
    ...Array.from({ length: 24 }, (_, i) => pictured(`pool-${i}`, { tags: ['meal:main', i % 2 ? 'flavor:savory' : 'flavor:sweet'] })),
    r('weak-rating', { rating: 4.4, ratingCount: 50 }),
    r('few-votes', { rating: 5, ratingCount: 3 }),
    r('no-photo', { rating: 4.9, ratingCount: 500 })
  ];

  it('gives the same order for the same seed and another one for a different seed', () => {
    expect(ids(picksOrder(recipes, '2026-11-05'))).toEqual(ids(picksOrder(recipes, '2026-11-05')));
    expect(ids(picksOrder(recipes, '2026-11-05'))).not.toEqual(ids(picksOrder(recipes, '2026-11-06')));
  });

  it('keeps every recipe exactly once, the pool first, the rest in rating order', () => {
    const order = picksOrder(recipes, '2026-11-05');
    expect(order).toHaveLength(recipes.length);
    expect(new Set(ids(order)).size).toBe(recipes.length);
    expect(ids(order).slice(0, 24).sort()).toEqual(recipes.slice(0, 24).map((x) => x.id).sort());
    // Starting from the catalog order, the weak ones follow best score first, whatever their catalogue position.
    expect(ids(order).slice(24)).toEqual(['no-photo', 'few-votes', 'weak-rating']);
  });
});

describe('mixPicks', () => {
  it('never puts more than two recipes from one blog in twelve consecutive cards', () => {
    const recipes = Array.from({ length: 8 }, (_, source) =>
      Array.from({ length: 12 }, (_, i) => pictured(`s${source}-${i}`, { source: `blog-${source}` }))
    ).flat();
    const mixed = mixPicks(picksOrder(recipes, '2026-11-05'));
    expect(ids(mixed).sort()).toEqual(ids(recipes).sort());
    for (let start = 0; start + 12 <= mixed.length; start++) {
      const sources = mixed.slice(start, start + 12).map((x) => x.source);
      for (const source of new Set(sources)) {
        expect(sources.filter((s) => s === source).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('relaxes the cap when one blog cannot meet it, without dropping recipes', () => {
    const recipes = [
      ...Array.from({ length: 30 }, (_, i) => pictured(`loud-${i}`, { source: 'loud' })),
      ...Array.from({ length: 5 }, (_, i) => pictured(`quiet-${i}`, { source: 'quiet' })),
      ...Array.from({ length: 5 }, (_, i) => pictured(`small-${i}`, { source: 'small' }))
    ];
    const mixed = mixPicks(picksOrder(recipes, '2026-11-05'));
    expect(ids(mixed).sort()).toEqual(ids(recipes).sort());
  });

  it('leaves a shelf of one blog in its order: there is no mix to correct', () => {
    const recipes = Array.from({ length: 20 }, (_, i) => pictured(`one-${i}`, { source: 'only', tags: [i === 0 ? 'flavor:sweet' : 'flavor:savory'] }));
    const order = picksOrder(recipes, '2026-11-05');
    expect(ids(mixPicks(order, { savouryLead: true }))).toEqual(ids(order));
  });

  it('leads savoury on three cards of every four on the default screen', () => {
    const recipes = Array.from({ length: 60 }, (_, i) =>
      pictured(`r-${i}`, {
        // One source per recipe: the blog cap has nothing to correct, so the savoury lead stands alone.
        source: `blog-${i}`,
        tags: ['meal:main', i % 4 === 0 ? 'flavor:sweet' : 'flavor:savory']
      })
    );
    const mixed = mixPicks(picksOrder(recipes, '2026-11-05'), { savouryLead: true });
    expect(ids(mixed).sort()).toEqual(ids(recipes).sort());
    for (let start = 0; start + 4 <= mixed.length; start += 4) {
      const block = mixed.slice(start, start + 4).map((x) => x.tags.includes('flavor:savory'));
      expect(block).toEqual([true, true, true, false]);
    }
  });

  it('does not force savoury when the cook chose a filter', () => {
    const recipes = Array.from({ length: 20 }, (_, i) =>
      pictured(`r-${i}`, { source: 'only', tags: [i % 4 === 0 ? 'flavor:sweet' : 'flavor:savory'] })
    );
    const order = picksOrder(recipes, '2026-11-05');
    expect(ids(mixPicks(order))).toEqual(ids(order));
  });
});

describe("searchRecipes with Today's picks", () => {
  const recipes = [
    r('best', { source: 'a', rating: 5, ratingCount: 300, tags: ['meal:dessert', 'flavor:sweet'] }),
    r('strong', { source: 'b', rating: 4.9, ratingCount: 200 }),
    r('good', { source: 'c', rating: 4.8, ratingCount: 150 }),
    r('plain', { source: 'd', rating: 4.5, ratingCount: 20 }),
    r('other-blog', { source: 'e', rating: 4.7, ratingCount: 90 })
  ];

  it("defaults to the seeded picks order and keeps Top rated's exact rating order", () => {
    const picked = searchRecipes(recipes, { sort: 'picks', seed: '2026-11-05' });
    expect(ids(picked).sort()).toEqual(ids(recipes).sort());
    expect(ids(picked)).toEqual(ids(picksOrder(recipes, '2026-11-05')));
    expect(ids(searchRecipes(recipes, { sort: 'rating' }))).toEqual(['best', 'strong', 'good', 'other-blog', 'plain']);
    expect(ids(searchRecipes(recipes, { seed: '2026-11-05' }))).toEqual(['best', 'strong', 'good', 'other-blog', 'plain']);
  });

  it('applies the savoury lead to the default screen only', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      r(`r-${i}`, { source: `blog-${i}`, rating: 4.9, ratingCount: 100, tags: ['meal:main', i % 4 === 0 ? 'flavor:sweet' : 'flavor:savory'] })
    );
    const landing = searchRecipes(many, { sort: 'picks', seed: '2026-11-05', savouryLead: true });
    const filtered = searchRecipes(many, { sort: 'picks', seed: '2026-11-05', meals: ['main'] });
    expect(landing.slice(0, 4).map((x) => x.tags.includes('flavor:savory'))).toEqual([true, true, true, false]);
    expect(ids(filtered)).toEqual(ids(picksOrder(many, '2026-11-05')));
  });

  it('keeps relevance for text search unless a sort is chosen', () => {
    const text = [
      r('title-hit', { title: 'Lentil Soup', ing: [] }),
      r('ingredient-hit', { title: 'Stew', ing: ['red lentil'] })
    ];
    expect(ids(searchRecipes(text, { text: 'lentil' }))).toEqual(['title-hit', 'ingredient-hit']);
  });
});
