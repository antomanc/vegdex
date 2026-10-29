import { describe, expect, it } from 'vitest';
import { findNonVegan } from '../src';

describe('findNonVegan', () => {
  it.each([
    '1 cup unsweetened almond milk',
    '2 tbsp vegan butter, melted',
    '1 flax egg (1 tbsp ground flaxseed + 3 tbsp water)',
    '1 cup canned coconut cream',
    '2 tbsp peanut butter',
    '1/2 tsp cream of tartar',
    '1 can butter beans',
    '1 medium eggplant, cubed',
    '1 cup vegan parmesan',
    '1 tbsp vegan fish sauce',
    '2 cups vegetable broth or no-chicken broth',
    '1/2 cup dairy-free yogurt',
    '1 cup milk of choice',
    '1 butternut squash',
    '1 cup nutritional yeast',
    '10.053 oz oyster mushrooms',
    'vanilla ice cream or whipped topping',
    '3/4 teaspoon salt (omit for unsalted butter)',
    '1/4 cup club soda (or use more milk)',
    '60 g veganer parmesan käse',
    '1 el öl (oder vegane butter)',
    '1 tablespoon of the butter sauce from above',
    '1/4 tsp salt (black salt for an egg flavor)',
    '2 cups chicken flavor broth',
    'optional shredded parmesan (i used violife)',
    '1 (10 oz.) bag oyster crackers',
    '1 (14 ounce or 400 ml) can full-fat coconut milk',
    "6 cup lamb's lettuce",
    '2 beef tomatoes (diced)',
    '1 cup mock chicken pieces',
    '2 tsp chicken spice mix',
    '1/4 cup vegan mayo',
    '1/4 tsp salt, less if your butter is salty',
    "8 tablespoons butter, i used miyoko's plant butter (cold)",
    '1/3 cup feta cheese; i used dairy-free',
    '2 cups leftover vegan mac and cheese',
    '1 cup bread and butter pickles',
    '1 cup coconut milk (use 1/2 cup coconut cream), or 1/3 cup yogurt + 2/3 cup water'
  ])('accepts %s', (line) => {
    expect(findNonVegan([line])).toEqual([]);
  });

  it.each([
    ['2 large eggs', 'egg'],
    ['4 tbsp unsalted butter', 'butter'],
    ['1 cup whole milk', 'milk'],
    ['2 tbsp honey', 'honey'],
    ['1/2 cup grated parmesan cheese', 'cheese'],
    ['1 lb chicken breast', 'meat'],
    ['1 tbsp fish sauce', 'fish'],
    ['1 packet gelatin', 'gelatin'],
    ['1/2 cup greek yogurt', 'yogurt'],
    ['1 cup heavy cream', 'cream'],
    ['1/4 cup shredded parmesan cheese', 'cheese'],
    ['2 eggs, or 2 flax eggs', 'egg'],
    ['1/2 cup kewpie mayonnaise', 'egg'],
    ['1 large egg (wilcox organic cage free)', 'egg']
  ])('flags %s', (line, term) => {
    expect(findNonVegan([line])[0]?.term).toBe(term);
  });
});

it.each([
  '2 tbsp vegan butter and 2 eggs',
  '2 eggs and vegan butter',
  '2 tbsp vegan butter; 2 eggs',
  '2 tbsp vegan butter, 2 eggs',
  '2 eggs with vegan butter',
  'vegan butter, eggs',
  'eggs (or flax eggs)'
])('keeps plant qualification attached to its own ingredient in %s', (line) => {
  expect(findNonVegan([line])).toEqual(expect.arrayContaining([expect.objectContaining({ term: 'egg' })]));
});
