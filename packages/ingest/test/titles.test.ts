import { expect, it } from 'vitest';
import { normalizeTitle } from '../src/titles';

it.each([
  ['VEGAN SPLIT PEA SOUP', 'Vegan Split Pea Soup'],
  ['KALE QUINOA SALAD', 'Kale Quinoa Salad'],
  ['the Best Vegan Garlic Alfredo Sauce', 'The Best Vegan Garlic Alfredo Sauce'],
  ['crispy corn fritters with roasted jalapeno crema', 'Crispy corn fritters with roasted jalapeno crema'],
  ['BBQ TOFU BLT WITH PB&J', 'BBQ Tofu BLT With PB&J'],
  ['Vegan BBQ with Tofu', 'Vegan BBQ with Tofu'],
  ["CHEF’S SOUP (GLUTEN-FREE)", "Chef’s Soup (Gluten-Free)"],
])('normalizes %s', (original, expected) => expect(normalizeTitle(original, 'en')).toBe(expected));

it('uses sentence case for Italian and preserves existing source casing', () => {
  expect(normalizeTitle('ZUPPA DI LENTICCHIE', 'it')).toBe('Zuppa di lenticchie');
  expect(normalizeTitle('Gnocchi di barbabietola e patate (senza uova)', 'it')).toBe('Gnocchi di barbabietola e patate (senza uova)');
});
