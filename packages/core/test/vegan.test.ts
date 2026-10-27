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
    '1 cup nutritional yeast'
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
    ['1 cup heavy cream', 'cream']
  ])('flags %s', (line, term) => {
    expect(findNonVegan([line])[0]?.term).toBe(term);
  });
});
