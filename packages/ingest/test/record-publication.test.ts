import { applyLineRecord, parseLine, renderIngredient, scaleIngredient, type ParsedIngredient } from '@vegdex/core';
import { shippedLineRecord } from '../src/line-records';
import { describe, expect, it } from 'vitest';
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

describe('a part read from its record', () => {
  const vocab = loadVocabulary();
  const read = (line: string) => applyLineRecord(parseLine(line, vocab.lookup('en'), 'en'), shippedLineRecord('en', line), vocab.lookup('en'), { en: vocab.display('en'), it: vocab.display('it') });
  const shown = (p: ParsedIngredient, language: string) => renderIngredient(p, vocab.display(language), language, 'us', 'en')?.join(' ');

  it('agrees with the count again after scaling', () => {
    expect(shown(scaleIngredient(read('1 onion, chopped')[0]!, 3), 'it')).toBe('3 cipolle, tritate');
    expect(shown(read('1 onion, chopped')[0]!, 'it')).toBe('1 cipolla, tritata');
  });
  it('keeps an amount the parser did not add', () => {
    expect(read('1/4 cup Non dairy milk such as almond, oat or light coconut (plus 2 tablespoons )')[0]!.text).toBeUndefined();
  });
  it('keeps a rounded fraction on a part of its own', () => {
    expect(read('Optional add-ins: 1/2 tbsp dill (2/3 cup raisins or other dried fruit)').find((p) => /raisins/.test(p.name))?.quantity).toBeCloseTo(0.67, 2);
  });
  it('finds the ingredient of a part the parser did not split out', () => {
    const parts = read('1 cup fresh or thawed frozen cranberries ((plus 1/4 cup for topping))');
    expect(parts.every((p) => p.concept)).toBe(true);
  });
});
