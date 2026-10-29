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

it('publishes only recipes passing both independent vegan checks and reports concept exclusions', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const base = store.recipes['quinoa-salad']!;
  const recipes = [
    { ...base, id: 'concept-only', title: 'Quark Bowl', ingredients: ['1 cup quark'] },
    { ...base, id: 'text-only', ingredients: ['1 tbsp mystery honey drizzle'] },
    { ...base, id: 'both', ingredients: ['1 cup quark', '2 eggs'] },
    { ...base, id: 'qualified', ingredients: ['2 tbsp vegan butter', '1 cup plant milk', '1 tbsp vegan parmesan'] },
    { ...base, id: 'separate-animal', ingredients: ['2 tbsp vegan butter', '1 cup quark'] },
    { ...base, id: 'unmapped', ingredients: ['1 tbsp mystery seasoning'] },
    { ...base, id: 'unapproved-source', sourceId: 'not-a-vegan-source', ingredients: ['1 cup oats'] },
    { ...base, id: 'translated', url: 'https://example.com/de/bowl/', ingredients: ['1 cup oats'] }
  ];
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-vegan-'));
  dirs.push(out);
  const report = emitDataset(recipes, [{ id: base.sourceId, name: 'The Simple Veganista', url: 'https://simple-veganista.com' }], out);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  expect(full.recipes.map((r) => r.id)).toEqual(['qualified', 'unmapped']);
  expect(report.excluded.map((r) => r.id)).toEqual(['concept-only', 'text-only', 'both', 'separate-animal']);
  expect(report.otherLanguage).toBe(1);
  expect(report.excluded[0]).toMatchObject({
    id: 'concept-only', title: 'Quark Bowl', url: base.url,
    hits: [expect.objectContaining({ concept: 'off:6e0f5e50cfafafa5', line: '1 cup quark' })]
  });
  expect(report.excluded[2]!.hits).toEqual(expect.arrayContaining([
    expect.objectContaining({ term: 'egg' }),
    expect.objectContaining({ concept: 'off:6e0f5e50cfafafa5' })
  ]));
  const dictionary = JSON.parse(fs.readFileSync(path.join(out, 'dictionary.json'), 'utf8'));
  for (const id of ['veg:0001', 'veg:0002', 'veg:0003']) {
    expect(dictionary.concepts.find((c: { id: string }) => c.id === id)).toMatchObject({ vegan: 'yes' });
  }
});
