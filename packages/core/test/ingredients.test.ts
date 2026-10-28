import { describe, expect, it } from 'vitest';
import { parseIngredient } from '../src';

describe('parseIngredient', () => {
  it.each([
    'Serve with my Vegan Lemon Cream Sauce',
    'I make my own homemade almond milk very creamy',
    'Pumpkin pie spice is a blend of cinnamon',
    "If you are using cashews and you don't have a high-powered blender"
  ])('preserves original text for the recipe sheet: %s', (line) => {
    expect(parseIngredient(line).raw).toBe(line);
  });

  it.each([
    ['1/2 cup (~60g) raw cashews, soaked in cool water overnight', 0.5, 'cup', 'cashew', { quantity: 60, unit: 'g' }],
    ['1 ½ teaspoons kosher salt + more to taste', 1.5, 'tsp', 'salt', null],
    ['&#189; Tbsp fine sea salt', 0.5, 'tbsp', 'salt', null],
    ['1&#8532; cup canned full-fat coconut milk', 1 + 2 / 3, 'cup', 'coconut milk', null],
    ['6 garlic clove', 6, 'clove', 'garlic', null],
    ['3 cloves garlic, minced', 3, 'clove', 'garlic', null],
    ['1 (15-ounce) can chickpeas, drained and rinsed', 1, 'can', 'chickpea', null],
    ['10 ounces (280g) of rigatoni pasta, medium-sized macaroni shells', 10, 'oz', 'rigatoni pasta', { quantity: 280, unit: 'g' }],
    ['1 tablespoon tapioca flour or cornstarch', 1, 'tbsp', 'tapioca flour', null],
    ['2 large onions, diced', 2, null, 'onion', null],
    ['200 g extra-firm tofu, pressed', 200, 'g', 'tofu', { quantity: 200, unit: 'g' }],
    ['2-3 tbsp maple syrup', 2, 'tbsp', 'maple syrup', null],
    ['1 T olive oil', 1, 'tbsp', 'olive oil', null],
    ['1 t baking soda', 1, 'tsp', 'baking soda', null],
    ['Freshly cracked black pepper to taste', null, null, 'black pepper', null],
    ['Olive oil or avocado oil, (for roasting)', null, null, 'olive oil', null],
    ['2 scallions, thinly sliced', 2, null, 'green onion', null],
    ['1 cup cherry tomatoes, halved', 1, 'cup', 'cherry tomato', null],
    ['a pinch of salt', 1, 'pinch', 'salt', null]
  ])('%s', (line, quantity, unit, name, metric) => {
    const p = parseIngredient(line);
    if (quantity === null) expect(p.quantity).toBeNull();
    else expect(p.quantity).toBeCloseTo(quantity);
    expect(p.unit).toBe(unit);
    expect(p.name).toBe(name);
    if (metric) expect(p.metric).toEqual(metric);
  });

  it('keeps ranges', () => {
    expect(parseIngredient('2-3 tbsp maple syrup').quantityMax).toBe(3);
  });

  // Shapes that show up across the catalog and used to leak units or descriptors into the name.
  it.each([
    ['60 ml / ¼ cup water', 60, 'ml', 'water'],
    ['130 g / 1 cup raw cashews*', 130, 'g', 'cashew'],
    ['1 and 1/2 tbsp olive oil', 1.5, 'tbsp', 'olive oil'],
    ['1 and 1/2 tbsp chipotle peppers in adobo sauce (finely chopped)', 1.5, 'tbsp', 'chipotle peppers in adobo sauce'],
    ['1/4 + 1/8 teaspoon salt', 0.375, 'tsp', 'salt'],
    ['heaped ¼ tsp baking soda', 0.25, 'tsp', 'baking soda'],
    ['1/3 heaped cup sunflower seeds', 1 / 3, 'cup', 'sunflower seed'],
    ['1 heaping tbsp tomato paste', 1, 'tbsp', 'tomato paste'],
    ['½ cup + 2 tbsp caster sugar', 0.625, 'cup', 'sugar'],
    ['1 cup+ 2 Tablespoons all-purpose flour', 1.125, 'cup', 'all-purpose flour'],
    ['1 3-inch piece of ginger (, peeled and sliced)', 1, 'piece', 'ginger'],
    ['¼ of a small red onion (chopped)', 0.25, null, 'red onion'],
    ['1/3 cup packed light or dark coconut sugar', 1 / 3, 'cup', 'coconut sugar'],
    ['14 oz firm or extra firm tofu (, pressed for 5 mins and cubed)', 14, 'oz', 'tofu'],
    ['1 tbsp plain, unsweetened non-dairy milk', 1, 'tbsp', 'plant milk'],
    ['350 g silken (firm) tofu', 350, 'g', 'tofu'],
    ['3 cloves minced or grated garlic', 3, 'clove', 'garlic'],
    ['2 cups frozen or fresh raspberries', 2, 'cup', 'raspberry'],
    ['1 15 oz can chickpeas, drained', 1, 'can', 'chickpea'],
    ['three 15 oz cans black beans', 3, 'can', 'black bean'],
    ['2 inch piece of fresh ginger (coarsely chopped)', 2, 'inch', 'ginger'],
    ['40 g / heaped 1/3 cup cocoa powder', 40, 'g', 'cocoa powder'],
    ['4 loosely packed cups (50g) fresh basil leaves', 4, 'cup', 'basil leaf'],
    ['4 x-large garlic cloves', 4, 'clove', 'garlic']
  ])('%s', (line, quantity, unit, name) => {
    const p = parseIngredient(line);
    expect(p.quantity).toBeCloseTo(quantity);
    expect(p.unit).toBe(unit);
    expect(p.name).toBe(name);
  });

  it('keeps the metric side of a dual measure', () => {
    expect(parseIngredient('30-45 ml / 2-3 tbsp lemon juice')).toMatchObject({ quantity: 30, quantityMax: 45, unit: 'ml', name: 'lemon juice' });
  });
});
