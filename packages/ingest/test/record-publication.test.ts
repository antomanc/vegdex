import { expect, it } from 'vitest';
import type { Source } from '@vegdex/core';
import { prepareRecipes } from '../src/prepare';
import { loadStore } from '../src/store';
import { loadVocabulary } from '../src/vocab';

it('adds record concept evidence to the vegan gate without treating a retained parser concept as new evidence', () => {
  const base = loadStore('e2e/fixtures/store.json').recipes.pancakes!;
  const source = { id: base.sourceId, contentLanguage: 'en' } as Source;
  const recipe = (id: string, line: string) => ({ ...base, id, ingredients: [line] });
  const unsafe = 'veggies or meat that can be added: red bell pepper (sliced mushrooms, shallots, chicken, pork etc)';
  const result = prepareRecipes([recipe('unsafe', unsafe), recipe('qualified', '24 vegan meatballs')], [source], loadVocabulary(), []);
  expect(result.published.map(p => p.recipe.id)).toEqual(['qualified']);
  expect(result.excluded).toHaveLength(1);
  expect(result.excluded[0]?.hits).toEqual(expect.arrayContaining([
    expect.objectContaining({ line: unsafe, concept: 'off:811eb81b9d11d65a' }),
    expect.objectContaining({ line: unsafe, concept: 'off:09aabcd859e4a72f' })
  ]));
});
