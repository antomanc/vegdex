import {
  classify,
  ingredientNote,
  measurements,
  toMetric,
  type IngredientTables,
  safeTranslation,
  type TranslationMemory,
  DETAIL_SHARDS,
  findNonVegan,
  findNonVeganConcepts,
  parseIngredient,
  shardOf,
  type Catalog,
  groceryConcepts,
  canonicalName,
  aisleFor,
  languagePacks,
  gramsPerCup,
  type CatalogRecipe,
  type FullDataset,
  type Recipe,
  type ParsedIngredient,
  type Source
} from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { isOtherLanguage } from './sitemap';
import { conceptFamily, seed, usedLookup, type Concept } from './concepts';
import { buildTranslationQueue, emptyLearnedData, mergeEnrichment, type LearnedData, type TranslationQueue } from './enrichment';

export const seedTranslations = JSON.parse(fs.readFileSync(new URL('../data/translations.json', import.meta.url), 'utf8')) as TranslationMemory;
const displaySeeds = JSON.parse(fs.readFileSync(new URL('../data/ingredient-display.json', import.meta.url), 'utf8')) as Record<string, IngredientTables>;
export const seedIngredientTables: Record<string, IngredientTables> = Object.fromEntries(Object.entries(displaySeeds).map(([language, tables]) => [language, {
  ...tables, names: { ...Object.fromEntries(seed.concepts.flatMap((c) => c.names[language]?.[0] ? [[c.id, c.names[language]![0]!]] : [])), ...tables.names }
}]));
const blockedIds: string[] = JSON.parse(fs.readFileSync(new URL('../data/blocklist.json', import.meta.url), 'utf8'));

function toCatalog(r: Recipe, parsed: ParsedIngredient[], concepts: Map<string, Concept>): CatalogRecipe {
  const ing = [...new Set(parsed.map((p) => p.name).filter(Boolean))];
  const ingredientNames = r.contentLanguage === 'en' ? undefined : parsed.map((p) => p.concept
    ? conceptFamily([p.concept], concepts).flatMap((id) => concepts.get(id)?.names.en ?? []).join(' | ') : '');
  return {
    contentLanguage: r.contentLanguage ?? 'en',
    concepts: conceptFamily(parsed.flatMap((p) => p.concept ? [p.concept] : []), concepts),
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
    tags: classify(r, ingredientNames),
    ing
  };
}

export interface EmitReport {
  queue: TranslationQueue;
  published: number;
  held: Recipe[];
  excluded: { id: string; title: string; url: string; reason?: 'blocklist' | 'unsupported-language'; hits: { term: string; line: string; concept?: string }[] }[];
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
export function emitDataset(all: Recipe[], sources: Source[], outDir: string, { generatedAt = new Date().toISOString(), translations: committedTranslations = seedTranslations, ingredientTables: committedTables = seedIngredientTables, blocklist = blockedIds, previousQueue, learnedData = emptyLearnedData() }: { generatedAt?: string; translations?: TranslationMemory; ingredientTables?: Record<string, IngredientTables>; blocklist?: string[]; previousQueue?: TranslationQueue; learnedData?: LearnedData } = {}): EmitReport {
  const merged = mergeEnrichment(learnedData, committedTranslations, committedTables);
  const translations = merged.titles;
  const ingredientTables = merged.ingredientTables;
  const englishLookup = merged.aliases.en ?? {};
  const conceptVegan = Object.fromEntries(merged.concepts.map((c) => [c.id, c.vegan]));
  const excluded: EmitReport['excluded'] = [];
  const recipes: Recipe[] = [];
  const held: Recipe[] = [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const parsedById = new Map<string, ParsedIngredient[]>();
  const blocked = new Set(blocklist);
  let otherLanguage = 0;
  for (const original of all) {
    const source = sourceById.get(original.sourceId);
    if (!source) continue;
    const r = { ...original, contentLanguage: source.contentLanguage ?? 'en' };
    if (blocked.has(r.id)) {
      excluded.push({ id: r.id, title: r.title, url: r.url, reason: 'blocklist', hits: [] });
      continue;
    }
    if (isOtherLanguage(r.url, r.contentLanguage)) {
      otherLanguage++;
      continue;
    }
    if (!Object.hasOwn(languagePacks, r.contentLanguage)) {
      excluded.push({ id: r.id, title: r.title, url: r.url, reason: 'unsupported-language', hits: [] });
      continue;
    }
    const contentLookup = merged.aliases[r.contentLanguage] ?? {};
    const parsed = r.ingredients.map((line) => {
      const p = parseIngredient(line, contentLookup, r.contentLanguage);
      if (r.contentLanguage !== 'en' && p.concept) {
        const names = merged.byId.get(p.concept)?.names.en?.map(canonicalName) ?? [];
        p.densityName = names.find((name) => gramsPerCup(name) !== null);
      }
      return p;
    });
    const hits = [
      ...findNonVegan(r.ingredients, r.contentLanguage),
      ...findNonVeganConcepts(r.ingredients, contentLookup, conceptVegan, r.contentLanguage).map((hit) => ({ ...hit, term: hit.concept }))
    ];
    if (hits.length) excluded.push({ id: r.id, title: r.title, url: r.url, hits });
    else if (r.contentLanguage !== 'en' && parsed.some((p) => p.name && (!p.concept || p.conceptExact !== true))) {
      held.push(r);
      parsedById.set(r.id, parsed);
    }
    else {
      recipes.push(r);
      parsedById.set(r.id, parsed);
    }
  }

  const usedSources = sources.filter((s) => recipes.some((r) => r.sourceId === s.id)).map((s) => ({ ...s, contentLanguage: s.contentLanguage ?? 'en' }));
  const sorted = recipes.sort((a, b) => a.id.localeCompare(b.id));
  const parsed = sorted.map((r) => parsedById.get(r.id)!);
  const rows = sorted.map((r, i) => toCatalog(r, parsed[i]!, merged.byId));
  const used = new Set(rows.flatMap((r) => r.concepts ?? []));
  const lookupFor = (language: string) => ({
    ...usedLookup(language, used),
    ...Object.fromEntries(Object.entries(merged.aliases[language] ?? {}).filter(([, id]) => used.has(id)))
  });
  const lookup = lookupFor('en');
  // English concept names keep shopping rows and density conversions stable across source languages.
  const groceryLines = parsed.flatMap((lines, i) => lines.map((p) => sorted[i]!.contentLanguage !== 'en' && p.concept
    ? { ...p, name: merged.byId.get(p.concept)?.names.en?.map(canonicalName).filter(Boolean).sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? p.name } : p));
  const grocery = groceryConcepts(groceryLines, englishLookup);
  for (const p of groceryLines) if (p.concept && !grocery[p.concept]) grocery[p.concept] = [p.name, aisleFor(p.name)];
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
  for (const language of new Set([...Object.keys(translations), ...Object.keys(ingredientTables)])) {
    const memory = translations[language] ?? {};
    const titles = Object.fromEntries([...new Set(rows.map((r) => r.title))].sort().flatMap((original) => {
      const title = safeTranslation(original, memory[original], language);
      return title !== original ? [[original, title]] : [];
    }));
    const tables = ingredientTables[language];
    const usedNames = new Set(parsed.flatMap((lines) => lines.flatMap((p) => p.concept ? [p.concept] : [])));
    const usedNotes = new Set(parsed.flat().map(ingredientNote).filter(Boolean));
    const usedUnits = new Set(parsed.flat().flatMap((p) => {
      const metric = toMetric(p);
      return [...measurements(ingredientNote(p)).map(([, unit]) => unit), ...p.unit ? [p.unit] : [], ...metric ? [metric.unit, ...(metric.unit !== 'cm' && Math.max(metric.quantity, metric.quantityMax ?? 0) >= 1000 ? [metric.unit === 'g' ? 'kg' : 'l'] : [])] : []];
    }));
    const ingredients = tables ? {
      names: Object.fromEntries(Object.entries(tables.names).filter(([id]) => usedNames.has(id))),
      notes: Object.fromEntries(Object.entries(tables.notes).filter(([note]) => usedNotes.has(note))),
      units: Object.fromEntries(Object.entries(tables.units).filter(([unit]) => usedUnits.has(unit)))
    } : undefined;
    write(`overlay/${language}.json`, { language, titles, ...(ingredients ? { ingredients } : {}) });
  }
  write('concept-coverage.json', coverage);
  write('dictionary.json', { provenance: seed.provenance, concepts: merged.concepts.filter((c) => used.has(c.id)) });
  for (const language of Object.keys(merged.aliases))
    write(`lookup/${language}.json`, { provenance: seed.provenance, aliases: lookupFor(language), ...(language === 'en' ? { grocery } : {}) });
  write('catalog.json', catalog);
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  const queuedRecipes = [...sorted, ...held].sort((a, b) => a.id.localeCompare(b.id));
  const queue = buildTranslationQueue(queuedRecipes, queuedRecipes.map((r) => parsedById.get(r.id)!), translations, ingredientTables, generatedAt, previousQueue, held);
  return { published: rows.length, held, excluded, otherLanguage, bySource, bytes, queue };
}
