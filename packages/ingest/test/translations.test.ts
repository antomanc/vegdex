import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { type Catalog, type LanguageOverlay } from '@vegdex/core';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

it('emits only used safe titles in a lazy overlay while retaining catalog originals', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const recipe = store.recipes.pancakes!;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-titles-'));
  dirs.push(out);
  emitDataset([recipe], [{ id: recipe.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' }], out, {
    translations: { en: {}, it: { [recipe.title]: 'Pancake vegani soffici', Unused: 'Inutilizzato' } }
  });
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  const catalog = read('catalog.json') as Catalog;
  const overlay = read('overlay/it.json') as LanguageOverlay;
  expect(catalog.recipes[0]!.title).toBe('Fluffy Vegan Pancakes');
  expect(catalog).not.toHaveProperty('titles');
  expect(overlay).toEqual({ language: 'it', titles: { 'Fluffy Vegan Pancakes': 'Pancake vegani soffici' } });
  emitDataset([recipe], [{ id: recipe.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' }], out, {
    translations: { it: { [recipe.title]: 'Pancake al burro' } }
  });
  expect(read('overlay/it.json').titles).toEqual({});
});
