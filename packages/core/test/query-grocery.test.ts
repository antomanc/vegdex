import { describe, expect, it } from 'vitest';
import { compileGroceryList, searchRecipes, type CatalogRecipe } from '../src';

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
