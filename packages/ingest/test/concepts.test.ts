import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { lookupConcept, parseIngredient, searchRecipes, shardOf, type Catalog, type FullDataset } from '@vegdex/core';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

it('uses the pinned dictionary and committed qualified seeds through public parsing and lookup', () => {
  const { concepts } = JSON.parse(fs.readFileSync(new URL('../data/concepts.json', import.meta.url), 'utf8')) as { concepts: { id: string; names: { en: string[]; it: string[] } }[] };
  const en = Object.fromEntries(concepts.flatMap((c) => c.names.en.map((n: string) => [n, c.id])));
  const it = Object.fromEntries(concepts.flatMap((c) => c.names.it.map((n: string) => [n, c.id])));
  expect(parseIngredient('400 g chickpeas, drained', en).concept).toBe(lookupConcept('ceci', it));
  expect(lookupConcept('ceci', it)).toBe('off:7ed0f0da39d5b63b');
  expect(lookupConcept('garbanzo', en)).toBe(lookupConcept('ceci', it));
  for (const [plant, animal] of [['vegan butter', 'butter'], ['plant milk', 'milk'], ['vegan parmesan', 'parmesan']]) {
    expect(lookupConcept(plant!, en)).toMatch(/^veg:/);
    expect(lookupConcept(plant!, en)).not.toBe(lookupConcept(animal!, en));
    expect(parseIngredient(`1 cup mystery ${plant}`, en).concept).toBeNull();
  }
});

it('emits concepts, original English content and lazy used-only lookups from a fixture store', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const base = store.recipes['quinoa-salad']!;
  const recipes = [
    { ...base, id: 'bowl', title: 'Autumn Bowl', ingredients: ['400 g chickpeas, drained and rinsed', '1 cup pumpkin', 'salt to taste', '1 tbsp mystery seasoning'] },
    { ...base, id: 'fungi', title: 'Forest Bowl', ingredients: ['1 cup pumpkin', '8 oz cremini mushrooms'] },
    { ...base, id: 'unsafe', ingredients: ['1 tbsp honey', '1 carrot'] }
  ];
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-concepts-'));
  dirs.push(out);
  const report = emitDataset(recipes, [{ id: base.sourceId, name: 'The Simple Veganista', url: 'https://simple-veganista.com' }], out);
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  const catalog = read('catalog.json') as Catalog;
  const full = read('recipes.full.json') as FullDataset;
  const en = read('lookup/en.json').aliases;
  const it = read('lookup/it.json').aliases;
  expect(report.published).toBe(2); // Unmapped English stays published; the text vegan gate still applies.
  expect(report.excluded).toHaveLength(1);
  expect(catalog.sources[0]).toMatchObject({ contentLanguage: 'en' });
  expect(catalog.recipes[0]).toMatchObject({ title: 'Autumn Bowl', contentLanguage: 'en', concepts: expect.arrayContaining([lookupConcept('ceci', it)]) });
  expect(catalog.recipes[0]).not.toHaveProperty('parsedIngredients');
  expect(catalog).not.toHaveProperty('lookup');
  const detail = read(`details/${String(shardOf('bowl')).padStart(2, '0')}.json`).bowl;
  expect(detail.ingredients).toEqual(recipes[0]!.ingredients);
  expect(detail.parsedIngredients[0]).toMatchObject({ raw: '400 g chickpeas, drained and rinsed', concept: lookupConcept('ceci', it), quantity: 400, unit: 'g', note: 'drained and rinsed' });
  expect(full.recipes[0]!.ingredients).toEqual(detail.ingredients);
  expect(full.lookup).toEqual(en);
  expect(lookupConcept('banana', it)).toBeNull(); // Unused dictionary entries never reach the web lookup.
  expect(searchRecipes(catalog.recipes, { text: 'ceci' }, it).map((r) => r.id)).toEqual(['bowl']);
  expect(searchRecipes(catalog.recipes, { include: ['zucca'], exclude: ['funghi'] }, it).map((r) => r.id)).toEqual(['bowl']);
  expect(searchRecipes(catalog.recipes, { include: ['ceci', 'funghi'] }, it)).toEqual([]);
  expect(searchRecipes(catalog.recipes, { exclude: ['ceci', 'funghi'] }, it)).toEqual([]);
  expect(read('concept-coverage.json')).toMatchObject({ lines: 6, mapped: 5, unmapped: { 'mystery seasoning': 1 } });
  expect(read('lookup/it.json').provenance.license).toContain('/odbl/');
});
