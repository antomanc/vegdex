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
  type Source
} from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { isOtherLanguage } from './sitemap';

function toCatalog(r: Recipe): CatalogRecipe {
  const ing = [...new Set(r.ingredients.map((line) => parseIngredient(line).name).filter(Boolean))];
  return {
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
 * - details/NN.json: raw ingredient lines, loaded when a recipe is opened
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
  const usedSources = sources.filter((s) => recipes.some((r) => r.sourceId === s.id));
  const sorted = recipes.sort((a, b) => a.id.localeCompare(b.id));
  const rows = sorted.map(toCatalog);

  fs.rmSync(path.join(outDir, 'details'), { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'details'), { recursive: true });

  const catalog: Catalog = { version: 1, generatedAt, sources: usedSources, recipes: rows };
  const full: FullDataset = {
    version: 1,
    generatedAt,
    sources: usedSources,
    recipes: rows.map((row, i) => ({ ...row, ingredients: sorted[i]!.ingredients }))
  };

  const shards: Record<string, string[]>[] = Array.from({ length: DETAIL_SHARDS }, () => ({}));
  for (const r of sorted) shards[shardOf(r.id)]![r.id] = r.ingredients;

  let bytes = 0;
  const write = (name: string, value: unknown) => {
    const json = JSON.stringify(value);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, name), json);
  };
  write('catalog.json', catalog);
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { published: rows.length, excluded, otherLanguage, bySource, bytes };
}
