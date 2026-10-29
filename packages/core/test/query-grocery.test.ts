import { describe, expect, it } from 'vitest';
import { compileGroceryList, groceryConcepts, parseIngredient, searchRecipes, type CatalogRecipe } from '../src';

const r = (id: string, over: Partial<CatalogRecipe>): CatalogRecipe => ({
  id, title: id, source: 's', url: 'u', image: null, minutes: 20, servings: 4, rating: 4.5, ratingCount: 10,
  calories: null, protein: null, published: null, tags: ['meal:main', 'flavor:savory'], ing: [], ...over
});

describe('searchRecipes', () => {
  const recipes = [
    r('tofu-spinach', { title: 'Tofu Spinach Curry', ing: ['firm tofu', 'spinach', 'coconut milk'] }),
    r('mushroom-tofu', { title: 'Mushroom Tofu Stir Fry', ing: ['tofu', 'cremini mushroom'] }),
    r('pancakes', { title: 'Fluffy Pancakes', minutes: 15, tags: ['meal:breakfast', 'flavor:sweet'], ing: ['flour'] })
  ];

  it('filters by include/exclude ingredients', () => {
    const out = searchRecipes(recipes, { include: ['tofu'], exclude: ['mushrooms'] });
    expect(out.map((x) => x.id)).toEqual(['tofu-spinach']);
  });

  it('filters by meal, flavor and time', () => {
    expect(searchRecipes(recipes, { meals: ['breakfast'], flavor: 'sweet', maxMinutes: 15 }).map((x) => x.id)).toEqual(['pancakes']);
  });

  it('ranks title matches first', () => {
    expect(searchRecipes(recipes, { text: 'curry' }).map((x) => x.id)).toEqual(['tofu-spinach']);
  });
});

describe('compileGroceryList', () => {
  it('omits explanatory sentences but keeps unquantified ingredients and long names', () => {
    const list = compileGroceryList([{
      recipeId: 'notes', multiplier: 1,
      ingredients: [
        'Serve with my Vegan Lemon Cream Sauce',
        'I make my own homemade almond milk very creamy',
        'Pumpkin pie spice is a blend of cinnamon',
        "If you are using cashews and you don't have a high-powered blender",
        'salt to taste',
        'Indian long grain white basmati rice',
        'Pumpkin pie spice (this is a blend of cinnamon)',
        '1 tsp pumpkin pie spice'
      ]
    }]);
    expect(list.map((item) => item.name).sort()).toEqual(['indian long grain white basmati rice', 'pumpkin pie spice', 'salt']);
    expect(list.find((item) => item.name === 'salt')?.toTaste).toBe(true);
  });

  it.each([[1, '1 ½ tbsp'], [2, '3 tbsp']])('scales a mixed-number chipotle amount by %s', (multiplier, amount) => {
    const list = compileGroceryList([{
      recipeId: 'chipotle', multiplier,
      ingredients: ['1 and 1/2 tbsp chipotle peppers in adobo sauce (finely chopped)']
    }]);
    expect(list).toMatchObject([{ name: 'chipotle peppers in adobo sauce', amounts: [amount] }]);
  });

  it('sums same ingredients across recipes and scales', () => {
    const list = compileGroceryList([
      { recipeId: 'a', multiplier: 2, ingredients: ['1/2 cup (60g) raw cashews', '2 cloves garlic, minced', 'salt to taste'] },
      { recipeId: 'b', multiplier: 1, ingredients: ['30 g cashews', '3 garlic cloves', '1 (15-ounce) can chickpeas'] }
    ]);
    const by = Object.fromEntries(list.map((i) => [i.name, i]));
    expect(by.cashew?.amounts).toEqual(['150 g']);
    expect(by.garlic?.amounts).toEqual(['7 cloves']);
    expect(by.chickpea?.amounts).toEqual(['1 can']);
    expect(by.salt?.toTaste).toBe(true);
    expect(by.cashew?.recipeIds).toEqual(['a', 'b']);
  });

  it('formats volumes', () => {
    const list = compileGroceryList([
      { recipeId: 'a', multiplier: 1, ingredients: ['1 cup coconut milk', '1/2 cup coconut milk', '2 tbsp coconut milk'] }
    ]);
    expect(list[0]?.amounts).toEqual(['1 ⅔ cups (390 ml)']);
  });

  it('walks the store: produce first, other last', () => {
    const list = compileGroceryList([
      { recipeId: 'a', multiplier: 1, ingredients: ['1 tsp cumin', '2 cups rice', '1 onion', '1 tbsp mystery powder blend'] }
    ]);
    const aisles = [...new Set(list.map((i) => i.aisle))];
    expect(aisles[0]).toBe('produce');
    expect(aisles.at(-1)).toBe('other');
    expect(aisles.indexOf('grains & pasta')).toBeLessThan(aisles.indexOf('spices'));
  });

  it('files dried spices and canned produce where they are sold', () => {
    const list = compileGroceryList([
      { recipeId: 'a', multiplier: 1, ingredients: ['black pepper to taste', '1 tsp chili powder', '1 can diced tomatoes', '1 tsp garlic powder'] }
    ]);
    const aisle = Object.fromEntries(list.map((i) => [i.name, i.aisle]));
    expect(aisle['black pepper']).toBe('spices');
    expect(aisle['chili powder']).toBe('spices');
    expect(aisle['garlic powder']).toBe('spices');
    expect(aisle.tomato).toBe('canned & jarred');
  });
});

describe('compileGroceryList with ingredient concepts', () => {
  const lookup = {
    chickpea: 'chickpea', chickpeas: 'chickpea', 'chick pea': 'chickpea', 'chick peas': 'chickpea', 'garbanzo bean': 'chickpea',
    rocket: 'rocket', arugula: 'rocket', tomato: 'tomato', tomatoes: 'tomato',
    sugar: 'sugar', 'granulated sugar': 'white-sugar', 'vanilla extract': 'vanilla', 'pure vanilla extract': 'pure-vanilla',
    'corn starch': 'cornstarch', cornstarch: 'cornstarch', 'vegan butter': 'plant-butter', 'dairy-free butter': 'plant-butter', 'peanut butter': 'peanut-butter', 'coconut milk': 'coconut-milk'
  };
  // The catalog's own lines decide each concept's row name and aisle.
  const catalog = ['1 can chickpeas', '2 cups chickpeas', '1 cup cooked chick peas', '1 cup garbanzo beans', '2 cups arugula', '1 cup rocket', '1 tbsp vegan butter', '1 tbsp dairy-free butter', '1 tbsp peanut butter',
    '1 tbsp corn starch', '1 tbsp cornstarch'];
  const concepts = groceryConcepts(catalog.map((line) => parseIngredient(line, lookup)), lookup);
  const compile = (inputs: { recipeId: string; ingredients: string[]; multiplier?: number }[], units?: 'us' | 'metric') =>
    compileGroceryList(inputs.map((i) => ({ multiplier: 1, ...i })), { units, lookup, concepts });
  const byName = (list: ReturnType<typeof compileGroceryList>) => Object.fromEntries(list.map((i) => [i.name, i]));

  it('merges synonyms of one concept into one item and keeps every recipe and original line', () => {
    const list = compile([
      { recipeId: 'salad', ingredients: ['400 g chickpeas, drained and rinsed', '1-2 cups rocket', '2 tbsp vegan butter'] },
      { recipeId: 'curry', multiplier: 0.5, ingredients: ['2 cups cooked chick peas', '2 cups arugula', '1 tbsp dairy-free butter', '2 tbsp peanut butter'] }
    ]);
    expect(list.filter((i) => /chick ?pea/.test(i.name))).toMatchObject([{
      name: 'chickpea', aisle: 'beans & legumes', amounts: ['≈ 550 g'], recipeIds: ['salad', 'curry'],
      lines: ['400 g chickpeas, drained and rinsed', '2 cups cooked chick peas']
    }]);
    // Ranges keep using the upper end, after each recipe's multiplier.
    expect(list.filter((i) => i.recipeIds.includes('salad') && /rocket|arugula/.test(i.name))).toMatchObject([{ amounts: ['3 cups (720 ml)'] }]);
    expect(byName(list)['vegan butter']?.amounts).toEqual(['2 ½ tbsp']);
    expect(byName(list)['peanut butter']?.amounts).toEqual(['1 tbsp']);
  });

  it("files every synonym of a concept under one name in the aisle the catalog's lines agree on", () => {
    expect(concepts).toEqual({
      chickpea: ['chickpea', 'beans & legumes'], rocket: ['rocket', 'produce'], 'plant-butter': ['vegan butter', 'tofu & alternatives'],
      cornstarch: ['cornstarch', 'baking & sweeteners']
    });
    for (const line of ['1 cup cooked chick peas', '1 cup chickpeas', '1 cup garbanzo beans'])
      expect(compile([{ recipeId: 'a', ingredients: [line] }]), line).toMatchObject([{ name: 'chickpea', aisle: 'beans & legumes' }]);
    expect(compile([{ recipeId: 'a', ingredients: ['1 cup arugula'] }])).toMatchObject([{ name: 'rocket', aisle: 'produce' }]);
    expect(compile([{ recipeId: 'a', ingredients: ['1 tbsp corn starch', '1 tbsp cornstarch', '1 cup cornmeal', '1 cup corn'] }]).map(({ name, aisle }) => [name, aisle])).toEqual([
      ['corn', 'produce'], ['cornmeal', 'grains & pasta'], ['cornstarch', 'baking & sweeteners']
    ]);
    for (const line of ['1 tbsp cornflour', '1 tbsp corn flour', '2 tbsp corn syrup'])
      expect(compile([{ recipeId: 'a', ingredients: [line] }])[0]?.aisle, line).toBe('baking & sweeteners');
  });

  it('keeps canned produce apart from fresh produce', () => {
    const list = compile([
      { recipeId: 'a', ingredients: ['1 can diced tomatoes'] },
      { recipeId: 'b', ingredients: ['2 tomatoes'] }
    ]);
    expect(list.filter((i) => i.name === 'tomato').map(({ aisle, amounts, recipeIds }) => ({ aisle, amounts, recipeIds }))).toEqual([
      { aisle: 'produce', amounts: ['2'], recipeIds: ['b'] },
      { aisle: 'canned & jarred', amounts: ['1 can'], recipeIds: ['a'] }
    ]);
  });

  it.each(['us', 'metric'] as const)('weighs sugar cups with the density table and vanilla with the blog\'s own grams (%s)', (units) => {
    const list = byName(compile([
      { recipeId: 'cake', ingredients: ['274 g granulated sugar', '1 tsp (5 g) vanilla extract'] },
      { recipeId: 'frosting', ingredients: ['1/3 cup (90 ml) sugar', '1/8 tsp pure vanilla extract'] }
    ], units));
    expect(list.sugar?.amounts).toEqual(['≈ 350 g']);
    expect(list['vanilla extract']?.amounts).toEqual(['≈ 6 g']);
  });

  it.each(['us', 'metric'] as const)('weighs vanilla extract spoons with its USDA density when no blog grams are given (%s)', (units) => {
    const list = byName(compile([
      { recipeId: 'a', ingredients: ['5 g vanilla extract'] },
      { recipeId: 'b', ingredients: ['1/8 tsp pure vanilla extract'] }
    ], units));
    expect(list['vanilla extract']?.amounts).toEqual(['≈ 6 g']);
  });

  it('keeps separate totals when no conversion is known and never adds cans to weights', () => {
    const list = byName(compile([
      { recipeId: 'a', ingredients: ['5 g fregola sarda', '1 can coconut milk', '200 g coconut milk'] },
      { recipeId: 'b', ingredients: ['1/8 cup fregola sarda', '1 cup coconut milk'] }
    ]));
    expect(list['fregola sarda']?.amounts).toEqual(['5 g', '2 tbsp']);
    expect(list['coconut milk']?.amounts).toEqual(['≈ 430 g', '1 can']);
  });

  it('falls back to names for unmapped ingredients', () => {
    const list = compile([
      { recipeId: 'a', ingredients: ['1 tbsp mystery powder blend'] },
      { recipeId: 'b', ingredients: ['2 tbsp mystery powder blend'] }
    ]);
    expect(list).toMatchObject([{ name: 'mystery powder blend', aisle: 'other', amounts: ['3 tbsp'], recipeIds: ['a', 'b'] }]);
  });
});
