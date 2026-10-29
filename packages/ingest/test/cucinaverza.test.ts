import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { compileGroceryList, renderIngredient, searchRecipes, type FullDataset, type Source } from '@vegdex/core';
import { extractRecipe } from '../src/extract';
import { emitDataset } from '../src/emit';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const samples = ['gnocchi', 'fudge'].map((name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/cucinaverza-${name}.json`, import.meta.url), 'utf8')));
const source = { id: 'cucinaverza', name: 'Cucinaverza', url: 'https://cucinaverza.com', contentLanguage: 'it' };

it('extracts and publishes a real Italian source while holding its unmapped compound recipe', () => {
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
  expect(sources).toContainEqual(source);
  const recipes = samples.map((sample) => extractRecipe(`<script type="application/ld+json">${JSON.stringify(sample.recipe)}</script>`, sample.sourceUrl, source.id)!);
  expect(recipes[0]).toMatchObject({ title: 'Gnocchi di barbabietola e patate (senza uova)', minutes: 60, servings: 4 });
  expect(recipes[0]!.ingredients).toEqual(samples[0].recipe.recipeIngredient);
  expect(recipes[1]).toMatchObject({ minutes: 130, servings: 1 });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-cucinaverza-'));
  dirs.push(out);
  const report = emitDataset(recipes, [source], out);
  expect(report.published).toBe(1);
  expect(report.held.map((r) => r.id)).toEqual([recipes[1]!.id]);
  expect(report.queue.held.map((r) => r.id)).toEqual([recipes[1]!.id]);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  expect(full.recipes).toHaveLength(1);
  const gnocchi = full.recipes[0]!;
  expect(gnocchi).toMatchObject({ contentLanguage: 'it', title: recipes[0]!.title, ingredients: recipes[0]!.ingredients });
  expect(gnocchi.tags).toContain('meal:main');
  expect(gnocchi.tags).not.toContain('free:gluten-free');
  expect(gnocchi.tags).not.toContain('free:soy-free');
  expect(searchRecipes(full.recipes, { include: ['beetroot'] }, full.lookup).map((r) => r.id)).toEqual([gnocchi.id]);
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/en.json'), 'utf8'));
  expect(overlay.titles[gnocchi.title]).toBe('Vegan Beetroot and Potato Gnocchi');
  expect(renderIngredient(gnocchi.parsedIngredients![0]!, overlay.ingredients, 'en', 'metric')).toEqual(['300 g', 'cooked beetroot']);
  expect(renderIngredient(gnocchi.parsedIngredients![2]!, overlay.ingredients, 'en', 'metric'))
    .toEqual(['350 g', 'flour type 0, plus more as needed, using as little as possible']);
  const list = compileGroceryList([{ recipeId: gnocchi.id, ingredients: gnocchi.ingredients, parsedIngredients: gnocchi.parsedIngredients, contentLanguage: 'it', multiplier: 2 }], { concepts: full.grocery, lookup: full.lookup, units: 'metric' });
  expect(list.find((item) => item.name === 'cooked beetroot')).toMatchObject({ amounts: ['600 g'] });
  expect(list.find((item) => item.name === 'flour type 0')).toMatchObject({ amounts: ['700 g'] });
});
