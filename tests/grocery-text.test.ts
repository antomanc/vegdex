import { expect, it } from 'vitest';
import { groceryListText } from '../apps/web/src/lib/grocery-text';

const words = { title: 'Shopping list', recipesHeading: 'For these recipes:' };
const curry = { title: 'Spinach Tofu Curry', excluded: false };
const soup = { title: 'Red Lentil Soup', excluded: false };

it('lists each aisle in the order shown, items with their amounts as displayed, then the recipes', () => {
  const text = groceryListText({
    ...words,
    aisles: [
      { label: 'produce', items: [{ name: 'garlic', amount: '5 cloves', checked: false }, { name: 'spinach', amount: '≈ 200 g', checked: false }] },
      { label: 'spices', items: [{ name: 'salt', amount: 'to taste', checked: false }, { name: 'bay leaf', amount: '', checked: false }] }
    ],
    recipes: [curry, soup]
  });
  expect(text).toBe([
    'Shopping list',
    '',
    'Produce',
    '- Garlic: 5 cloves',
    '- Spinach: ≈ 200 g',
    '',
    'Spices',
    '- Salt: to taste',
    '- Bay leaf',
    '',
    'For these recipes:',
    '- Spinach Tofu Curry',
    '- Red Lentil Soup'
  ].join('\n'));
});

it('leaves out checked items, and an aisle with nothing left to grab', () => {
  const text = groceryListText({
    ...words,
    aisles: [
      { label: 'produce', items: [{ name: 'garlic', amount: '5 cloves', checked: true }, { name: 'spinach', amount: '200 g', checked: false }] },
      { label: 'spices', items: [{ name: 'cumin', amount: '1 tsp', checked: true }] }
    ],
    recipes: [curry]
  });
  expect(text).toContain('- Spinach: 200 g');
  expect(text).not.toContain('Garlic');
  expect(text).not.toContain('Spices');
});

it('names only the recipes on this trip', () => {
  const text = groceryListText({ ...words, aisles: [], recipes: [curry, { ...soup, excluded: true }] });
  expect(text).toContain('Spinach Tofu Curry');
  expect(text).not.toContain('Red Lentil Soup');
});
