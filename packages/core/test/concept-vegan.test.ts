import { expect, it } from 'vitest';
import { findNonVegan, findNonVeganConcepts } from '../src';

it('reports an animal concept even when its English synonym passes the text check', () => {
  const lines = ['1 cup quark'];
  expect(findNonVegan(lines)).toEqual([]);
  expect(findNonVeganConcepts(lines, { quark: 'cheese' }, { cheese: 'no' })).toEqual([
    { concept: 'cheese', line: '1 cup quark' }
  ]);
});

const lookup = { quark: 'cheese', 'vegan butter': 'plant-butter', 'plant milk': 'plant-milk', 'vegan parmesan': 'plant-parmesan' };
const vegan = { cheese: 'no', 'plant-butter': 'yes', 'plant-milk': 'yes', 'plant-parmesan': 'yes' } as const;

it.each([
  '1 cup quark or vegan butter',
  '1 cup quark and vegan butter',
  '2 tbsp vegan butter and 1 cup quark',
  '2 tbsp vegan butter; 1 cup quark',
  '2 tbsp vegan butter, 1 cup quark',
  'vegan butter, quark',
  'quark, vegan butter',
  'quark with vegan butter',
  'quark (or vegan butter)'
])('does not let qualification of a separate ingredient or alternative excuse %s', (line) => {
  expect(findNonVeganConcepts([line], lookup, vegan)).toEqual([
    expect.objectContaining({ concept: 'cheese', line })
  ]);
});

it('accepts distinct plant concepts and leaves unmapped and uncertain English to the text check', () => {
  expect(findNonVeganConcepts([
    '2 tbsp vegan butter', '1 cup plant milk', '1 tbsp vegan parmesan',
    '1 tbsp mystery seasoning', '1 tsp rennet', '1 cup unclassified ingredient'
  ], { ...lookup, rennet: 'rennet', 'unclassified ingredient': 'unknown' }, { ...vegan, rennet: 'maybe', unknown: 'unknown' })).toEqual([]);
});

it('lets a plant qualifier on the same option excuse its concept, as the text check does', () => {
  expect(findNonVeganConcepts(['1 cup quark (i used soy quark)', '1 cup quark, i used vegan quark', '1 cup quark; dairy-free'], lookup, vegan)).toEqual([]);
});

it('keeps qualifiers on the primary option and ignores ingredient headings and note-only animal mentions', () => {
  expect(findNonVeganConcepts(['vegan butter or quark', 'salt (omit for quark)', 'For the quark filling'], lookup, vegan)).toEqual([]);
});

it.each([
  '8 ounces Chanterelle, Oyster, or Cremini mushrooms, roughly chopped',
  '4 oz. shiitake, oyster or mushrooms (see notes for using dried wild mushrooms)',
  '1 1/2 cups vegan cheese shreds, cheddar preferred (optional)',
  '2 cups not beef broth (or any other vegan broth)',
  'pepita parmesan (or your favorite parm recipe)',
  '“honey” mustard: 1 tablespoon each dijon mustard and maple syrup',
  '1 Romano or Ramiro pepper, diced finely',
  'vegan mayo, sour cream, or other creamy dressing (optional)',
  'Vegan sour cream, yogurt, or cashew cream, for serving',
  '1/2 cup milk + 2 tablespoons ((150mL) any vegan milk works)',
  'Vegan protein of choice: tofu, vegan bologna, sausages, etc (diced)',
  'Serving suggestions (optional: croutons, parmesan, olive oil)',
  '3/4 cup shredded vegan cheese I use a mix of vegan mozzarella and Parmesan cheese'
])('reads complete ingredient names, alternatives and notes in %s', (line) => {
  const names = { ...lookup, oyster: 'oyster', cheddar: 'cheese', 'beef broth': 'beef', 'parmesan cheese': 'cheese', parmesan: 'cheese', parm: 'cheese',
    honey: 'honey', romano: 'cheese', 'romano pepper': 'sweet-pepper', 'sour cream': 'cream', yogurt: 'yogurt', milk: 'milk', sausage: 'meat',
    shiitake: 'mushroom', chanterelle: 'mushroom', 'vegan cheese': 'plant-cheese', tofu: 'tofu', 'vegan mayo': 'plant-mayo' };
  const status = { ...vegan, oyster: 'no', beef: 'no', honey: 'no', cream: 'no', yogurt: 'no', milk: 'no', meat: 'no', 'sweet-pepper': 'yes' } as const;
  expect(findNonVeganConcepts([line], names, status)).toEqual([]);
});

it.each([
  ['garam masala, cilantro, lemon juice, yogurt or raita, pepper flakes', 'yogurt'],
  ['1 cup quark or nutritional yeast', 'cheese'],
  ['1/2 cup milk + 2 tbsp quark', 'cheese'],
  ['vegan cheese I use a mix', null],
  ['Topping: quark, vegan butter', 'cheese']
])('still finds a separate or primary animal ingredient in %s', (line, concept) => {
  const names = { ...lookup, yogurt: 'yogurt', cilantro: 'cilantro', 'lemon juice': 'lemon', 'nutritional yeast': 'yeast', milk: 'plant-milk' };
  const hits = findNonVeganConcepts([line], names, { ...vegan, yogurt: 'no' });
  expect(hits.map((h) => h.concept)).toEqual(concept ? [concept] : []);
});
