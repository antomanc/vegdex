import {
  classify,
  safeTranslation,
  type TranslationMemory,
  DETAIL_SHARDS,
  findNonVegan,
  findNonVeganConcepts,
  parseIngredient,
  shardOf,
  type Catalog,
  groceryConcepts,
  type CatalogRecipe,
  type FullDataset,
  type Recipe,
  type ParsedIngredient,
  type Source
} from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { isOtherLanguage } from './sitemap';
import { conceptFamily, conceptVegan, englishLookup, seed, usedLookup } from './concepts';

export const seedTranslations = JSON.parse(fs.readFileSync(new URL('../data/translations.json', import.meta.url), 'utf8')) as TranslationMemory;

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
  excluded: { id: string; title: string; url: string; hits: { term: string; line: string; concept?: string }[] }[];
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
/** `generatedAt` defaults to now; fixtures pin it so regenerating them changes nothing. */
export function emitDataset(all: Recipe[], sources: Source[], outDir: string, { generatedAt = new Date().toISOString(), translations = seedTranslations }: { generatedAt?: string; translations?: TranslationMemory } = {}): EmitReport {
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
    const hits = [
      ...findNonVegan(r.ingredients),
      ...findNonVeganConcepts(r.ingredients, englishLookup, conceptVegan).map((hit) => ({ ...hit, term: hit.concept }))
    ];
    if (hits.length) excluded.push({ id: r.id, title: r.title, url: r.url, hits });
    else recipes.push(r);
  }

  const usedSources = sources.filter((s) => recipes.some((r) => r.sourceId === s.id)).map((s) => ({ ...s, contentLanguage: s.contentLanguage ?? 'en' }));
  const sorted = recipes.sort((a, b) => a.id.localeCompare(b.id));
  const parsed = sorted.map((r) => r.ingredients.map((line) => parseIngredient(line, englishLookup)));
  const rows = sorted.map((r, i) => toCatalog(r, parsed[i]!));
  const used = new Set(rows.flatMap((r) => r.concepts ?? []));
  const lookup = usedLookup('en', used);
  // Shopping-list rows and aisles per concept, from the English lines that use them.
  const grocery = groceryConcepts(parsed.flat(), englishLookup);
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

  fs.rmSync(path.join(outDir, 'overlay'), { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'overlay'), { recursive: true });

  const catalog: Catalog = { version: 1, generatedAt, dictionary: seed.provenance, sources: usedSources, recipes: rows };
  const full: FullDataset = {
    version: 1,
    generatedAt,
    dictionary: seed.provenance,
    sources: usedSources,
    lookup,
    grocery,
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
  for (const [language, memory] of Object.entries(translations)) {
    const titles = Object.fromEntries([...new Set(rows.map((r) => r.title))].sort().flatMap((original) => {
      const title = safeTranslation(original, memory[original], language);
      return title !== original ? [[original, title]] : [];
    }));
    write(`overlay/${language}.json`, { language, titles });
  }
  write('concept-coverage.json', coverage);
  write('dictionary.json', { provenance: seed.provenance, concepts: seed.concepts.filter((c) => used.has(c.id)) });
  for (const language of ['en', 'it'] as const)
    write(`lookup/${language}.json`, { provenance: seed.provenance, aliases: usedLookup(language, used), ...(language === 'en' ? { grocery } : {}) });
  write('catalog.json', catalog);
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { published: rows.length, excluded, otherLanguage, bySource, bytes };
}
