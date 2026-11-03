import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { searchRecipes, unpackCatalog } from '@vegdex/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

let out = '';
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));

beforeAll(() => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-suggest-'));
  emitDataset(Object.values(store.recipes), sources, out);
});
afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

it.each(['en', 'it'])('suggests %s ingredient names once each, every one leaving some recipes', (language) => {
  const names: string[] = read(`suggest/${language}.json`);
  const { aliases } = read(`lookup/${language}.json`);
  const { recipes } = unpackCatalog(read('catalog.json'));
  expect(names.length).toBeGreaterThan(20);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(searchRecipes(recipes, { include: [name] }, aliases).length, name).toBeGreaterThan(0);
});

it('names ingredients in the page language', () => {
  expect(read('suggest/en.json')).toContain('onion');
  expect(read('suggest/it.json')).toContain('cipolle');
  expect(read('suggest/it.json')).not.toContain('onion');
});

it('puts the ingredients most recipes use first', () => {
  const names: string[] = read('suggest/en.json');
  expect(names.indexOf('garlic')).toBeLessThan(names.indexOf('cocoa powder'));
});
