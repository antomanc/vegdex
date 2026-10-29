import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { compileGroceryList, metricLine, renderIngredient, searchRecipes, type FullDataset, type Recipe } from '@vegdex/core';
import { emitDataset } from '../src/emit';
import { crawlSource } from '../src/crawl';
import type { Store } from '../src/store';
import { isCandidateUrl } from '../src/sitemap';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const source = { id: 'italian', name: 'Italian Vegan Fixture', url: 'https://italian.example', contentLanguage: 'it' };
const base: Recipe = {
  id: 'ceci', sourceId: source.id, title: 'Insalata di ceci', url: 'https://italian.example/insalata/', image: null,
  minutes: 10, servings: 2, rating: null, ratingCount: null, calories: null, protein: 22, published: null,
  categories: ['Insalata'], cuisines: ['Italiana'], keywords: ['senza glutine'], ingredients: ['400 g ceci', '1,5 cucchiai olio di oliva']
};
function emit(recipes: Recipe[], sources = [source]) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-italian-'));
  dirs.push(out);
  const report = emitDataset(recipes, sources, out);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  return { report, full, out };
}

it('publishes a fully mapped Italian recipe with its content language and concept-derived facts', () => {
  const { report, full } = emit([base]);
  expect(report.published).toBe(1);
  const r = full.recipes[0]!;
  expect(r).toMatchObject({ contentLanguage: 'it', title: 'Insalata di ceci', ingredients: base.ingredients });
  expect(r.parsedIngredients?.[1]).toMatchObject({ quantity: 1.5, unit: 'tbsp', raw: base.ingredients[1] });
  expect(r.tags).toEqual(expect.arrayContaining(['meal:salad', 'flavor:savory', 'free:gluten-free', 'high-protein', 'cuisine:italian']));
  expect(r.tags).not.toContain('free:oil-free');
  expect(searchRecipes(full.recipes, { include: ['chickpeas'] }, full.lookup).map((r) => r.id)).toEqual(['ceci']);
});

it('does not publish unmapped, unsupported or animal-product Italian recipes', () => {
  const { report, full } = emit([
    base,
    { ...base, id: 'unmapped', ingredients: ['1 g ingrediente sconosciuto'] },
    { ...base, id: 'animal', ingredients: ['2 uova'] },
    { ...base, id: 'qualified', ingredients: ['2 cucchiai burro vegetale'] },
    { ...base, id: 'separate-animal', ingredients: ['2 cucchiai burro vegetale e 1 uovo'] },
    { ...base, id: 'translated', url: 'https://italian.example/de/insalata/' }
  ]);
  expect(full.recipes.map((r) => r.id)).toEqual(['ceci', 'qualified']);
  expect(report.held.map((r) => r.id)).toEqual(['unmapped']);
  expect(report.excluded.map((r) => r.id)).toEqual(['animal', 'separate-animal']);
  expect(report.otherLanguage).toBe(1);
  const unsupported = emit([base], [{ ...source, contentLanguage: 'unknown' }]);
  expect(unsupported.full.recipes).toEqual([]);
  expect(unsupported.report.excluded[0]).toMatchObject({ reason: 'unsupported-language' });
});

it('excludes translated editions relative to an Italian source while allowing its original-language prefix', () => {
  expect(isCandidateUrl('https://italian.example/it/insalata/', source.url, 'it')).toBe(true);
  expect(isCandidateUrl('https://italian.example/en/salad/', source.url, 'it')).toBe(false);
  const { full, report } = emit([
    { ...base, id: 'original', url: 'https://italian.example/it/insalata/' },
    { ...base, id: 'english-edition', url: 'https://italian.example/en/salad/' }
  ]);
  expect(full.recipes.map((r) => r.id)).toEqual(['original']);
  expect(report.otherLanguage).toBe(1);
});

it('does not award free-from claims to Italian names for nuts, soy, oil or wheat', () => {
  const { full, report } = emit([{ ...base, ingredients: ['10 g mandorle', '10 g tofu', '10 g olio di oliva', '10 g farina di frumento'] }]);
  expect(report.published).toBe(1);
  expect(full.recipes[0]!.tags.filter((t) => t.startsWith('free:'))).toEqual([]);
});

it('retains Italian allergen evidence in preparation notes and holds partially mapped compounds', () => {
  const { full, report } = emit([
    { ...base, ingredients: ['400 g ceci (con mandorle, soia, olio e farina di frumento)'] },
    { ...base, id: 'compound', ingredients: ['400 g ceci e ingrediente sconosciuto'] }
  ]);
  expect(report.published).toBe(1);
  expect(report.held.map((r) => r.id)).toEqual(['compound']);
  expect(full.recipes[0]!.tags.filter((t) => t.startsWith('free:'))).toEqual([]);
  const englishNote = emit([{ ...base, ingredients: ['400 g ceci (with cashews, soy sauce, oil and wheat flour)'] }]);
  expect(englishNote.full.recipes[0]!.tags.filter((t) => t.startsWith('free:'))).toEqual([]);
});

it('merges Italian and English ingredient concepts with the correct scaled quantities and aisle', () => {
  const { full } = emit([base]);
  const italian = full.recipes[0]!;
  const list = compileGroceryList([
    { recipeId: italian.id, ingredients: italian.ingredients, parsedIngredients: italian.parsedIngredients, contentLanguage: 'it', multiplier: 0.5 },
    { recipeId: 'english', ingredients: ['200 g chickpeas'], multiplier: 2 }
  ], { lookup: full.lookup, concepts: full.grocery, units: 'metric' });
  const chickpea = list.find((i) => i.recipeIds.includes('english'))!;
  expect(chickpea).toMatchObject({ aisle: 'beans & legumes', amounts: ['600 g'], recipeIds: ['ceci', 'english'] });
  expect(list).toHaveLength(2);
});

it('weighs Italian cup measures through the same known ingredient density for recipes and groceries', () => {
  const { full, out } = emit([{ ...base, ingredients: ['1 tazza di farina', '1 g sale'] }]);
  const r = full.recipes[0]!;
  const p = r.parsedIngredients![0]!;
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/en.json'), 'utf8'));
  expect(p.raw).toBe('1 tazza di farina');
  expect(renderIngredient(p, overlay, 'en', 'metric', 'it')).toEqual(['≈ 125 g', 'flour']);
  expect(renderIngredient(p, overlay, 'en', 'us', 'it')).toEqual(['1 cup', 'flour']);
  expect(metricLine(p.raw, p)?.[0]).toBe('≈ 125 g');
  expect(compileGroceryList([{ recipeId: r.id, ingredients: r.ingredients, parsedIngredients: r.parsedIngredients, contentLanguage: 'it', multiplier: 1 }], { lookup: full.lookup, concepts: full.grocery, units: 'metric' }).find((i) => i.lines.includes(p.raw))?.amounts).toEqual(['≈ 125 g']);
});

it('carries a configured source language from crawling into stored and emitted recipes', async () => {
  const server = http.createServer((req, res) => {
    const origin = `http://${req.headers.host}`;
    res.end(req.url === '/robots.txt' ? `User-agent: *\nSitemap: ${origin}/sitemap.xml` : req.url === '/sitemap.xml'
      ? `<urlset><url><loc>${origin}/insalata/</loc></url></urlset>`
      : `<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Insalata di ceci', recipeIngredient: ['400 g ceci', '1 g sale'] })}</script>`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address() as { port: number };
    const configured = { ...source, url: `http://127.0.0.1:${address.port}` };
    const store: Store = { version: 1, urls: {}, recipes: {} };
    const result = await crawlSource(configured, store, { maxPerSource: 1, gapMs: 0, concurrency: 1, log: () => {} });
    expect(result.recipes).toBe(1);
    expect(Object.values(store.recipes)[0]).toMatchObject({ contentLanguage: 'it', title: 'Insalata di ceci' });
    expect(emit(Object.values(store.recipes), [configured]).full.recipes[0]).toMatchObject({ contentLanguage: 'it' });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
