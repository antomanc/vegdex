import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { type Catalog, type LanguageVocabulary } from '@vegdex/core';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';
import { loadVocabulary } from '../src/vocab';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

it('emits only used safe titles in a lazy overlay while retaining catalog originals', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const recipe = store.recipes.pancakes!;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-titles-'));
  dirs.push(out);
  const source = { id: recipe.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' };
  const vocabulary = loadVocabulary();
  vocabulary.files.it!.titles = { [recipe.title]: 'Pancake vegani soffici', Unused: 'Inutilizzato' };
  emitDataset([recipe], [source], out, { vocabulary });
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  const catalog = read('catalog.json') as Catalog;
  const overlay = read('overlay/it.json') as LanguageVocabulary;
  expect(catalog.recipes[0]!.title).toBe('Fluffy Vegan Pancakes');
  expect(catalog).not.toHaveProperty('titles');
  expect({ language: overlay.language, titles: overlay.titles }).toEqual({ language: 'it', titles: { 'Fluffy Vegan Pancakes': 'Pancake vegani soffici' } });
  for (const unsafe of ['Pancake al burro', 'Pasta al cheddar', 'Pasta al gorgonzola']) {
    vocabulary.files.it!.titles = { [recipe.title]: unsafe };
    emitDataset([recipe], [source], out, { vocabulary });
    expect(read('overlay/it.json').titles).toEqual({});
    expect((read('catalog.json') as Catalog).recipes[0]!.title).toBe(recipe.title);
  }
});

it('ships only the names, preparation terms and units the published lines use', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const recipe = store.recipes['quinoa-salad']!;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-ingredient-tables-'));
  dirs.push(out);
  emitDataset([recipe], [{ id: recipe.sourceId, name: 'The Simple Veganista', url: 'https://simple-veganista.com' }], out);
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/it.json'), 'utf8')) as LanguageVocabulary;
  expect(overlay.names['off:7ed0f0da39d5b63b']).toEqual({ one: 'cece', other: 'ceci', gender: 'm' });
  expect(overlay.terms['term:drained-rinsed']).toMatchObject({ 'm.pl': 'scolati e sciacquati' });
  expect(overlay.units.g).toEqual(['g', 'g']);
  expect(overlay.names).not.toHaveProperty('veg:0001');
  expect(overlay.terms).not.toHaveProperty('term:minced');
  expect(overlay.units).not.toHaveProperty('block');
});
