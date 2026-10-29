import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileGroceryList, renderIngredient, type Recipe } from '@vegdex/core';
import { afterEach, expect, it } from 'vitest';
import { emitDataset } from '../src/emit';
import { emptyLearnedData, learnedConceptId, readLearnedData, readTranslationQueue } from '../src/enrichment';
import { englishLookup, seed } from '../src/concepts';
import { updateBacklog } from '../src/nightly';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
const source = { id: 'example', name: 'Example Vegan', url: 'https://example.com' };
function recipe(id: string, ingredients = ['1 cup mystery flour, finely sifted']): Recipe {
  return { id, title: 'Mystery Pancakes', sourceId: source.id, url: `https://example.com/${id}/`, image: null,
    minutes: 10, servings: 2, rating: null, ratingCount: null, calories: null, protein: null, published: null,
    categories: [], cuisines: [], keywords: [], ingredients };
}
function output() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-enrichment-'));
  dirs.push(out);
  return out;
}

it('keeps English recipes published and deduplicates missing work with its original first-seen date', () => {
  const recipes = [recipe('one'), recipe('two')];
  const first = emitDataset(recipes, [source], output(), { generatedAt: '2026-10-01T00:00:00.000Z' });
  expect(first.published).toBe(2);
  expect(first.queue.held).toEqual([]);
  expect(first.queue.tasks).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'title', original: 'Mystery Pancakes', targetLanguage: 'it', firstSeen: '2026-10-01T00:00:00.000Z' }),
    expect.objectContaining({ kind: 'ingredient', original: 'mystery flour' }),
    expect.objectContaining({ kind: 'note', original: 'finely sifted' })
  ]));
  const title = first.queue.tasks.find((task) => task.kind === 'title')!;
  expect(title.recipes.map((r) => r.id)).toEqual(['one', 'two']);
  expect(first.queue.tasks.filter((task) => task.kind === 'title')).toHaveLength(1);
  const later = emitDataset(recipes, [source], output(), { generatedAt: '2026-10-29T00:00:00.000Z', previousQueue: first.queue });
  expect(later.queue.tasks.map((task) => task.firstSeen)).toEqual(first.queue.tasks.map((task) => task.firstSeen));

});

it('publishes fully mapped Italian recipes while their title and note translations wait', () => {
  const out = output();
  const report = emitDataset([{ ...recipe('one', ['200 g ceci, scolati dolcemente']), title: 'Ceci nuovi' }], [{ ...source, contentLanguage: 'it' }], out);
  expect(report.published).toBe(1);
  expect(report.queue.held).toEqual([]);
  expect(report.queue.tasks).toContainEqual(expect.objectContaining({ kind: 'title', original: 'Ceci nuovi', sourceLanguage: 'it', targetLanguage: 'en' }));
  expect(report.queue.tasks).toContainEqual(expect.objectContaining({ kind: 'note', original: 'scolati dolcemente', sourceLanguage: 'it', targetLanguage: 'en' }));
});

it('queues held Italian recipes and preserves their age and notification across nightly emits', () => {
  const italianSource = { ...source, contentLanguage: 'it' };
  const recipes = [recipe('one', ['200 g farina misteriosa, setacciata finemente']), recipe('two', ['200 g farina misteriosa'])];
  const first = emitDataset(recipes, [italianSource], output(), { generatedAt: '2026-10-01T00:00:00.000Z' });
  expect(first.published).toBe(0);
  expect(first.queue.held).toEqual([
    { id: 'one', since: '2026-10-01T00:00:00.000Z' },
    { id: 'two', since: '2026-10-01T00:00:00.000Z' }
  ]);
  expect(first.queue.tasks).toContainEqual(expect.objectContaining({
    kind: 'ingredient', original: 'farina misteriosa', sourceLanguage: 'it', targetLanguage: 'en',
    recipes: expect.arrayContaining([expect.objectContaining({ id: 'one', line: recipes[0]!.ingredients[0] })])
  }));
  expect(first.queue.tasks.filter((task) => task.kind === 'ingredient')).toHaveLength(1);
  first.queue.held[0]!.notifiedAt = '2026-10-09T00:00:00.000Z';
  const later = emitDataset(recipes, [italianSource], output(), { generatedAt: '2026-10-29T00:00:00.000Z', previousQueue: first.queue });
  expect(later.queue.held).toEqual(first.queue.held);
  expect(later.queue.tasks.map((task) => task.firstSeen)).toEqual(first.queue.tasks.map((task) => task.firstSeen));
  const comments: string[] = [];
  const notified = updateBacklog({ ...later.queue, issueNumber: 77 }, 'antomanc/vegdex', (args, body) => {
    if (args[1] === 'comment') comments.push(body!);
    return args[1] === 'view' ? 'Translation backlog' : '';
  });
  expect(comments).toHaveLength(1);
  expect(comments[0]).toContain('- two');
  expect(comments[0]).not.toContain('- one');
  const nextNight = emitDataset(recipes, [italianSource], output(), { generatedAt: '2026-10-30T00:00:00.000Z', previousQueue: notified });
  updateBacklog(nextNight.queue, 'antomanc/vegdex', (args) => {
    if (args[1] === 'comment') throw new Error('Already notified');
    return args[1] === 'view' ? 'Translation backlog' : '';
  });
});

it('initializes genuinely missing enrichment files but refuses malformed persisted data', () => {
  const dir = output();
  const learned = path.join(dir, 'enrichment.json');
  const queue = path.join(dir, 'translation-queue.json');
  expect(readLearnedData(learned)).toEqual(emptyLearnedData());
  expect(readTranslationQueue(queue).tasks).toEqual([]);
  fs.writeFileSync(learned, '{"version":2}');
  expect(() => readLearnedData(learned)).toThrow(/enrichment/i);
  fs.writeFileSync(queue, '{"version":1,"tasks":"broken","held":[]}');
  expect(() => readTranslationQueue(queue)).toThrow(/queue/i);
});

it('keeps committed names, statuses, aliases and display entries authoritative over learned conflicts', () => {
  const learned = emptyLearnedData();
  const chickpea = englishLookup.chickpeas!;
  const quark = englishLookup.quark!;
  const butter = englishLookup.butter!;
  learned.concepts.push({ ...seed.concepts.find((c) => c.id === quark)!, vegan: 'yes', names: { en: ['chickpeas'], it: ['ceci'] } });
  learned.aliases.en = { chickpeas: quark, 'vegan butter': butter, 'mystery curd': quark };
  learned.aliases.it = { ceci: quark };
  learned.ingredientTables.it = { names: { [chickpea]: 'pollo' }, notes: { drained: 'pollo' }, units: { cup: ['secchio', 'secchi'] } };
  learned.titles.it = { 'Fluffy Vegan Pancakes': 'Dolci inventati' };
  const out = output();
  const report = emitDataset([
    recipe('allowed', ['1 cup chickpeas, drained']), recipe('animal', ['1 cup mystery curd']),
    { ...recipe('title', ['1 cup oats']), title: 'Fluffy Vegan Pancakes' }
  ], [source], out, { learnedData: learned });
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  expect(read('recipes.full.json').recipes.find((r: Recipe) => r.id === 'allowed').parsedIngredients[0].concept).toBe(chickpea);
  expect(read('lookup/it.json').aliases.ceci).toBe(chickpea);
  expect(report.excluded).toContainEqual(expect.objectContaining({ id: 'animal', hits: [expect.objectContaining({ concept: quark })] }));
  expect(read('overlay/it.json').ingredients.names[chickpea]).toBe('ceci');
  expect(read('overlay/it.json').ingredients.notes.drained).toBe('scolati');
  expect(read('overlay/it.json').ingredients.units.cup).toEqual(['tazza', 'tazze']);
  expect(read('overlay/it.json').titles['Fluffy Vegan Pancakes']).toBe('Pancake vegani soffici');
});

it('queues complete residual phrases and refuses learned aliases that erase alternatives or size', () => {
  const learned = emptyLearnedData();
  const chickpea = englishLookup.chickpeas!;
  learned.aliases.en = { 'small chickpeas': chickpea, 'chickpeas or lentils': chickpea };
  const out = output();
  const report = emitDataset([recipe('one', ['1 cup small chickpeas', '1 cup chickpeas or lentils'])], [source], out, { learnedData: learned });
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8'));
  expect(full.recipes[0].parsedIngredients.map((p: { conceptExact: boolean }) => p.conceptExact)).toEqual([false, false]);
  expect(report.queue.tasks.filter((task) => task.kind === 'ingredient').map((task) => task.original).sort()).toEqual(['chickpeas or lentils', 'small chickpeas']);
});

it('refuses learned aliases that name an animal product for a plant concept', () => {
  const learned = emptyLearnedData();
  learned.aliases.en = { 'salmon flakes': englishLookup.chickpeas! };
  learned.aliases.it = { 'polpo tenero': englishLookup.chickpeas! };
  const out = output();
  emitDataset([recipe('one', ['1 cup oats'])], [source], out, { learnedData: learned });
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  expect(read('lookup/en.json').aliases['salmon flakes']).toBeUndefined();
  expect(read('lookup/it.json').aliases['polpo tenero']).toBeUndefined();
});

it('uses safe learned concepts throughout parsing, search and display, and removes completed queue entries', () => {
  const learned = emptyLearnedData();
  const id = learnedConceptId('mystery flour');
  learned.concepts.push({ id, names: { en: ['mystery flour'], it: ['farina misteriosa'] }, parents: [], vegan: 'yes' });
  learned.titles.it = { 'Mystery Pancakes': 'Pancake misteriosi' };
  learned.ingredientTables.it = { names: { [id]: 'farina misteriosa' }, notes: { 'finely sifted': 'setacciata finemente' }, units: {} };
  const out = output();
  const report = emitDataset([recipe('one')], [source], out, { learnedData: learned });
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
  const full = read('recipes.full.json');
  const overlay = read('overlay/it.json');
  expect(full.recipes[0].parsedIngredients[0]).toMatchObject({ concept: id, conceptExact: true });
  expect(read('lookup/it.json').aliases['farina misteriosa']).toBe(id);
  expect(read('dictionary.json').concepts.find((c: { id: string }) => c.id === id).vegan).toBe('unknown');
  expect(compileGroceryList([{ recipeId: 'one', ingredients: recipe('one').ingredients, multiplier: 1 }], {
    lookup: full.lookup, concepts: full.grocery
  })[0]).toMatchObject({ name: 'mystery flour', concept: id });
  expect(overlay.titles['Mystery Pancakes']).toBe('Pancake misteriosi');
  expect(renderIngredient(full.recipes[0].parsedIngredients[0], overlay.ingredients, 'it', 'us')).toEqual(['1 tazza', 'farina misteriosa, setacciata finemente']);
  expect(report.queue.tasks).toEqual([]);
});
