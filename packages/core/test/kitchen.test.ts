import { describe, expect, it } from 'vitest';
import { cupboardOf, fridgeFit, fridgeOrder, kitchenOf, ownConcepts, planWeek, weekStats } from '../src';

// A small concept tree, packed by position the way catalog.json ships it.
const concepts = ['tofu', 'extra-firm tofu', 'almond', 'almond flour', 'chickpea', 'boiled chickpea', 'salt', 'sea salt', 'lime', 'cilantro', 'rice', 'onion', 'red onion', 'vegetable oil', 'olive oil', 'water'];
const at = (c: string) => concepts.indexOf(c);
const parents = concepts.map((c) => ({
  'extra-firm tofu': [at('tofu')],
  'almond flour': [at('almond')],
  'boiled chickpea': [at('chickpea')],
  'sea salt': [at('salt')],
  'red onion': [at('onion')],
  'olive oil': [at('vegetable oil')]
})[c] ?? []);
const lookup = Object.fromEntries([
  ...concepts.map((c) => [c, c]),
  ['farina di mandorle', 'almond flour'],
  ['cooked chickpeas', 'boiled chickpea']
]);
const kitchen = kitchenOf(concepts, parents, lookup);
const have = (...names: string[]) => new Set(names);

describe('kitchen', () => {
  it('keeps the concepts a recipe names itself, not the ones they imply', () => {
    expect(ownConcepts(['tofu', 'extra-firm tofu', 'lime'], kitchen)).toEqual(['extra-firm tofu', 'lime']);
  });

  it('lets an ingredient stand in for its kinds, but not for what is made from it', () => {
    expect(fridgeFit(['extra-firm tofu', 'boiled chickpea', 'red onion'], have('tofu', 'chickpea', 'onion'), kitchen).missing).toEqual([]);
    expect(fridgeFit(['almond flour'], have('almond'), kitchen).missing).toEqual(['almond flour']);
    // Olive oil is still an oil: the product word is the parent's too.
    expect(fridgeFit(['olive oil'], have('vegetable oil'), kitchen).missing).toEqual([]);
    // The specific stands in for the general.
    expect(fridgeFit(['tofu'], have('extra-firm tofu'), kitchen).missing).toEqual([]);
  });

  it('leaves the cupboard aisles out: spices, oils and sauces are not shopping for one recipe', () => {
    const cupboard = cupboardOf({ cumin: 'cumin', 'soy sauce': 'soy-sauce', lime: 'lime', 'smoked paprika': 'paprika' }, { 'soy-sauce': ['soy sauce', 'oils, vinegars & sauces'] });
    expect([...cupboard].sort()).toEqual(['cumin', 'paprika', 'soy-sauce']);
    const stocked = kitchenOf([...concepts, 'cumin'], [...parents, []], lookup, cupboard);
    expect(fridgeFit(['cumin', 'lime', 'tofu'], have('tofu'), stocked)).toEqual({ missing: ['lime'], used: 1 });
  });

  it('never lists salt, its kinds or water as missing, nor counts them as used', () => {
    expect(fridgeFit(['sea salt', 'water', 'lime'], have('lime'), kitchen)).toEqual({ missing: [], used: 1 });
  });
});

describe('fridgeOrder', () => {
  const recipe = (id: string, ...c: string[]) => ({ id, c });
  const recipes = [
    recipe('needs-two', 'tofu', 'boiled chickpea', 'lime', 'cilantro'),
    recipe('has-all-uses-one', 'extra-firm tofu', 'sea salt'),
    recipe('uses-nothing', 'rice', 'water'),
    recipe('needs-four', 'tofu', 'chickpea', 'lime', 'cilantro', 'rice', 'almond flour'),
    recipe('has-all-uses-three', 'tofu', 'boiled chickpea', 'red onion'),
    recipe('needs-one-uses-three', 'tofu', 'boiled chickpea', 'onion', 'lime')
  ];

  it('puts first what uses most of the fridge for least shopping, and leaves out what needs too much or uses too little', () => {
    const order = fridgeOrder(recipes, have('tofu', 'chickpea', 'onion'), kitchen, (r) => r.c, 3);
    expect(order.map((o) => [o.recipe.id, o.missing])).toEqual([
      ['has-all-uses-three', []],
      ['needs-one-uses-three', ['lime']],
      ['needs-two', ['lime', 'cilantro']]
    ]);
  });

  it('needs only one of the cook\'s things when the fridge holds one', () => {
    expect(fridgeOrder(recipes, have('tofu'), kitchen, (r) => r.c, 0).map((o) => o.recipe.id)).toEqual(['has-all-uses-one']);
  });
});

describe('planWeek', () => {
  const r = (id: string, source: string, ...c: string[]) => ({ id, source, title: id, c });
  const pool = [
    r('opener', 'a', 'tofu', 'lime', 'cilantro', 'rice'),
    r('stranger', 'b', 'almond flour', 'red onion', 'olive oil'),
    r('neighbour', 'c', 'lime', 'cilantro', 'chickpea', 'almond'),
    r('cousin', 'd', 'cilantro', 'rice', 'onion', 'chickpea'),
    r('twin', 'e', 'tofu', 'lime', 'cilantro', 'rice'),
    r('same-blog', 'a', 'lime', 'cilantro', 'rice', 'onion')
  ];
  const first = () => 0;

  it('follows the first dinner with the ones that share its shopping, never its twin, from another blog while it can', () => {
    const week = planWeek(pool, (x) => x.c, kitchen, { count: 3, random: first });
    expect(week.map((x) => x.id)).toEqual(['opener', 'neighbour', 'cousin']);
  });

  it('keeps the dinners the cook kept and fills a turned-down slot with another one', () => {
    const week = planWeek(pool, (x) => x.c, kitchen, { count: 3, slots: ['opener', null, 'cousin'], avoid: new Set(['neighbour']), random: first });
    expect(week.map((x) => x.id)).toEqual(['opener', 'stranger', 'cousin']);
  });

  it('does not plan two dishes named alike, whatever they share', () => {
    const named = [
      { id: 'w1', source: 'a', title: 'Vegan Wellington', c: ['tofu', 'onion'] },
      { id: 'w2', source: 'b', title: 'Easy Lentil Wellingtons', c: ['onion', 'almond', 'lime'] },
      { id: 'curry', source: 'c', title: 'Tofu Curry', c: ['tofu', 'rice', 'cilantro'] }
    ];
    expect(planWeek(named, (x) => x.c, kitchen, { count: 2, random: first }).map((x) => x.id)).toEqual(['w1', 'curry']);
  });

  it('counts the shopping once for the week and names what is shared', () => {
    const stats = weekStats([pool[0]!.c, pool[2]!.c, pool[3]!.c], kitchen);
    expect(stats).toEqual({
      items: 7,
      separate: 12,
      shared: [{ concept: 'cilantro', recipes: 3 }, { concept: 'chickpea', recipes: 2 }, { concept: 'lime', recipes: 2 }, { concept: 'rice', recipes: 2 }]
    });
  });
});
