import { expect, it } from 'vitest';
import type { Source } from '@vegdex/core';
import { refusedPhotos } from '../src/photos-check';
import { prepareRecipes } from '../src/prepare';
import { loadStore } from '../src/store';
import { loadVocabulary } from '../src/vocab';

it('lists a blog only when every sampled photo fails', async () => {
  const photos = new Map([['open', ['a', 'b']], ['mixed', ['bad', 'b']], ['closed', ['bad', 'worse']], ['down', ['gone']]]);
  const get = async (url: string) => {
    if (url === 'gone') throw new Error('network');
    return { status: url === 'bad' || url === 'worse' ? 403 : 200 };
  };
  expect(await refusedPhotos(photos, get)).toEqual([{ source: 'closed', status: 403 }, { source: 'down', status: 0 }]);
});

it('publishes a recipe from a blog that refuses photos without its photo', () => {
  const base = loadStore('e2e/fixtures/store.json').recipes.pancakes!;
  const source = { id: base.sourceId, contentLanguage: 'en', photosBlocked: true } as Source;
  const { published } = prepareRecipes([base], [source], loadVocabulary(), []);
  expect(published[0]!.recipe.image).toBeNull();
});
