import {
  classify,
  DETAIL_SHARDS,
  findNonVegan,
  parseIngredient,
  shardOf,
  type Catalog,
  type CatalogRecipe,
  type FullDataset,
  type Recipe,
  type ParsedIngredient,
  type Source
} from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { isOtherLanguage } from './sitemap';
import { conceptFamily, englishLookup, seed, usedLookup } from './concepts';

function toCatalog(r: Recipe, parsed: ParsedIngredient[]): CatalogRecipe {
  const ing = [...new Set(parsed.map((p) => p.name).filter(Boolean))];
  return {
    contentLanguage: r.contentLanguage ?? 'en',
    concepts: conceptFamily(parsed.flatMap((p) => p.concept ? [p.concept] : [])),
    id: r.id,
    title: r.title,
    source: r.sourceId,
    url: r.url,
    image: r.image,
    minutes: r.minutes,
    servings: r.servings,
    rating: r.rating,
    ratingCount: r.ratingCount,
    calories: r.calories,
    protein: r.protein,
    published: r.published,
    tags: classify(r),
    ing
  };
}

export interface EmitReport {
  published: number;
  excluded: { id: string; title: string; url: string; hits: { term: string; line: string }[] }[];
  /** Stored recipes from a translated edition of a blog, left out. */
  otherLanguage: number;
  bySource: Record<string, number>;
  bytes: number;
}

/**
 * Write the public dataset:
 * - catalog.json: everything the grid and filters need
 * - details/NN.json: original lines and parsed ingredients, loaded when a recipe is opened
 * - recipes.full.json: catalog + ingredient lines in one file, for the MCP server
 * Recipes the vegan check flags are left out and listed in the report; so are translated editions.
 */
export function emitDataset(all: Recipe[], sources: Source[], outDir: string): EmitReport {
  const excluded: EmitReport['excluded'] = [];
  const recipes: Recipe[] = [];
  const sourceIds = new Set(sources.map((s) => s.id));
  let otherLanguage = 0;
  for (const r of all) {
    if (!sourceIds.has(r.sourceId)) continue;
    if (isOtherLanguage(r.url)) {
      otherLanguage++;
      continue;
    }
    const hits = findNonVegan(r.ingredients);
    if (hits.length) excluded.push({ id: r.id, title: r.title, url: r.url, hits });
    else recipes.push(r);
  }

  const generatedAt = new Date().toISOString();
  const usedSources = sources.filter((s) => recipes.some((r) => r.sourceId === s.id)).map((s) => ({ ...s, contentLanguage: s.contentLanguage ?? 'en' }));
  const sorted = recipes.sort((a, b) => a.id.localeCompare(b.id));
  const parsed = sorted.map((r) => r.ingredients.map((line) => parseIngredient(line, englishLookup)));
  const rows = sorted.map((r, i) => toCatalog(r, parsed[i]!));
  const used = new Set(rows.flatMap((r) => r.concepts ?? []));
  const lookup = usedLookup('en', used);
  const unmapped: Record<string, number> = Object.create(null);
  let mapped = 0;
  for (const lines of parsed) for (const p of lines) {
    if (p.concept) mapped++;
    else unmapped[p.name || p.raw] = (unmapped[p.name || p.raw] ?? 0) + 1;
  }
  const coverage = { lines: parsed.flat().length, mapped, unmapped: Object.fromEntries(Object.entries(unmapped).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) };

  fs.rmSync(path.join(outDir, 'details'), { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'details'), { recursive: true });
  fs.rmSync(path.join(outDir, 'lookup'), { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'lookup'), { recursive: true });

  const catalog: Catalog = { version: 1, generatedAt, dictionary: seed.provenance, sources: usedSources, recipes: rows };
  const full: FullDataset = {
    version: 1,
    generatedAt,
    dictionary: seed.provenance,
    sources: usedSources,
    lookup,
    recipes: rows.map((row, i) => ({ ...row, ingredients: sorted[i]!.ingredients, parsedIngredients: parsed[i]! }))
  };

  const shards: Record<string, { ingredients: string[]; parsedIngredients: ParsedIngredient[] }>[] = Array.from({ length: DETAIL_SHARDS }, () => ({}));
  sorted.forEach((r, i) => { shards[shardOf(r.id)]![r.id] = { ingredients: r.ingredients, parsedIngredients: parsed[i]! }; });

  let bytes = 0;
  const write = (name: string, value: unknown) => {
    const json = JSON.stringify(value);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, name), json);
  };
  write('concept-coverage.json', coverage);
  write('dictionary.json', { provenance: seed.provenance, concepts: seed.concepts.filter((c) => used.has(c.id)) });
  for (const language of ['en', 'it'] as const) write(`lookup/${language}.json`, { provenance: seed.provenance, aliases: usedLookup(language, used) });
  write('catalog.json', catalog);
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { published: rows.length, excluded, otherLanguage, bySource, bytes };
}
