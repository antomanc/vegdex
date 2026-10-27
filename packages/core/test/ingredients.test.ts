import { describe, expect, it } from 'vitest';
import { parseIngredient } from '../src';

describe('parseIngredient', () => {
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
});
