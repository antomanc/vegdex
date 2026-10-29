import { describe, expect, it } from 'vitest';
import { compileGroceryList, metricLine } from '../src';

describe('metricLine', () => {
  it('keeps qualified measures as written when conversion would discard their wording', () => {
    for (const line of ['about 2 cups flour', '2 heaped cups flour', '2 scant cups flour', '60 ml / heaped 1/4 cup flour']) expect(metricLine(line), line).toBeNull();
  });

  it('weighs cups with the density table, marked as an estimate', () => {
    expect(metricLine('1 cup all-purpose flour')).toEqual(['≈ 125 g', 'all-purpose flour']);
    expect(metricLine('3 cups chopped kale')).toEqual(['≈ 120 g', 'chopped kale']);
    expect(metricLine('1 cup + 2 tablespoons sugar')).toEqual(['≈ 225 g', 'sugar']);
    expect(metricLine('1/2 to 1 cup water')).toEqual(['≈ 120–235 g', 'water']);
  });

  it("uses the blog's own grams as written, and drops the parenthetical that held them", () => {
    expect(metricLine('1 cup (120g) flour')).toEqual(['120 g', 'flour']);
    expect(metricLine('1 1/2 cups (8.6oz / 245g) vegan chocolate chips')).toEqual(['245 g', 'vegan chocolate chips']);
    expect(metricLine('1 cup / 125 g flour')).toEqual(['125 g', 'flour']);
    expect(metricLine('8 oz (225 g) tempeh')).toEqual(['225 g', 'tempeh']);
    expect(metricLine('2 1/3 cups all purpose flour ((280g))')).toEqual(['280 g', 'all purpose flour']);
    expect(metricLine('3/4 cup light brown sugar (packed – 150g)')).toEqual(['150 g', 'light brown sugar (packed)']);
    expect(metricLine('1 1/2 cups chickpeas (1 can, 400g)')).toEqual(['≈ 245 g', 'chickpeas (1 can, 400g)']);
  });

  it('keeps notes that are not a measure', () => {
    expect(metricLine('1 1/2 cups corn kernels (fresh, frozen, or canned)')).toEqual(['≈ 230 g', 'corn kernels (fresh, frozen, or canned)']);
  });

  it('weighs a cup measured in ml by the blog', () => {
    expect(metricLine('1 cup (240 ml) plant milk')).toEqual(['≈ 245 g', 'plant milk']);
    expect(metricLine('1/4 cup pumpkin puree ((5 ml))')).toEqual(['≈ 60 g', 'pumpkin puree']);
  });

  it('converts pounds, ounces and inches exactly', () => {
    expect(metricLine('1 lb potatoes, diced')).toEqual(['450 g', 'potatoes, diced']);
    expect(metricLine('14 oz firm tofu')).toEqual(['400 g', 'firm tofu']);
    expect(metricLine('1 inch ginger, grated')).toEqual(['2.5 cm', 'ginger, grated']);
  });

  it('weighs by the last alternative when the first only names a color', () => {
    expect(metricLine('1/2 cup dry brown or green lentils')).toEqual(['≈ 95 g', 'dry brown or green lentils']);
  });

  it('falls back to ml when the table does not know the ingredient', () => {
    expect(metricLine('1 cup fregola sarda')).toEqual(['240 ml', 'fregola sarda']);
  });

  it('writes kilograms past 1000 g', () => {
    expect(metricLine('5 cups all-purpose flour')).toEqual(['≈ 625 g', 'all-purpose flour']);
    expect(metricLine('10 cups all-purpose flour')).toEqual(['≈ 1.3 kg', 'all-purpose flour']);
  });

  it('leaves spoons, whole items and unmeasured lines as written', () => {
    expect(metricLine('2 tablespoons olive oil')).toBeNull();
    expect(metricLine('1/2 teaspoon kosher salt')).toBeNull();
    expect(metricLine('2 medium carrots, diced')).toBeNull();
    expect(metricLine('1 (15 oz) can chickpeas')).toBeNull();
    expect(metricLine('Salt and black pepper (to taste)')).toBeNull();
    expect(metricLine('200 g firm tofu')).toBeNull();
  });
});

describe('compileGroceryList in metric units', () => {
  it('merges cups and grams of the same ingredient into one weight', () => {
    const list = compileGroceryList(
      [
        { recipeId: 'a', multiplier: 1, ingredients: ['1 cup cashews', '1 inch ginger', '2 tbsp maple syrup'] },
        { recipeId: 'b', multiplier: 1, ingredients: ['150 g cashews', '1 cup fregola sarda'] }
      ],
      { units: 'metric' }
    );
    const by = Object.fromEntries(list.map((i) => [i.name, i.amounts]));
    expect(by.cashew).toEqual(['≈ 290 g']);
    expect(by.ginger).toEqual(['2.5 cm']);
    expect(by['maple syrup']).toEqual(['2 tbsp']);
    expect(by['fregola sarda']).toEqual(['240 ml']);
  });

  it('keeps US amounts by default', () => {
    const [item] = compileGroceryList([{ recipeId: 'a', multiplier: 1, ingredients: ['1 cup fregola sarda'] }]);
    expect(item?.amounts).toEqual(['1 cup (240 ml)']);
  });
});
