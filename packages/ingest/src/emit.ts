import {
  classify,
  toMetric,
  safeTranslation,
  DETAIL_SHARDS,
  shardOf,
  type Catalog,
  groceryConcepts,
  aisleFor,
  isTermId,
  type CatalogRecipe,
  type FullDataset,
  type LanguageVocabulary,
  type Recipe,
  type ParsedIngredient,
  type Source
} from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { conceptFamily, seed, type Concept } from './concepts';
import { measureCoverage, type Coverage } from './gaps';
import { blockedIds, prepareRecipes, type Excluded } from './prepare';
import { loadVocabulary, type Vocabulary } from './vocab';

function toCatalog(r: Recipe, parsed: ParsedIngredient[], concepts: Map<string, Concept>): CatalogRecipe {
  const ing = [...new Set(parsed.flatMap((p) => [p.name, p.also?.name ?? '']).filter(Boolean))];
  const ingredientNames = r.contentLanguage === 'en' ? undefined : parsed.map((p) => p.concept
    ? conceptFamily([p.concept], concepts).flatMap((id) => concepts.get(id)?.names.en ?? []).join(' | ') : '');
  return {
    contentLanguage: r.contentLanguage ?? 'en',
    concepts: conceptFamily(parsed.flatMap((p) => [p.concept, p.also?.concept].filter((c): c is string => !!c)), concepts),
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
  published: number;
  held: Recipe[];
  excluded: Excluded[];
  /** Stored recipes from a translated edition of a blog, left out. */
  otherLanguage: number;
  bySource: Record<string, number>;
  bytes: number;
  coverage: Coverage;
}

/** Only what the published lines use: names, terms and units of their concepts, and safe titles. */
function overlay(language: string, vocab: LanguageVocabulary, rows: CatalogRecipe[], parsed: ParsedIngredient[][]): LanguageVocabulary {
  const lines = parsed.flat();
  const ids = new Set(lines.flatMap((p) => [p.concept, p.also?.concept, ...(p.terms ?? []).map((t) => t.id)].filter((id): id is string => !!id)));
  const units = new Set(lines.flatMap((p) => {
    const metric = toMetric(p);
    return [p.unit, p.size?.unit, metric?.unit, metric && metric.unit !== 'cm' && Math.max(metric.quantity, metric.quantityMax ?? 0) >= 1000 ? (metric.unit === 'g' ? 'kg' : 'l') : null]
      .filter((u): u is string => !!u);
  }));
  const pick = <T>(table: Record<string, T>, used: Set<string>) => Object.fromEntries(Object.entries(table).filter(([key]) => used.has(key)));
  const titles = Object.fromEntries([...new Set(rows.map((r) => r.title))].sort().flatMap((original) => {
    const title = safeTranslation(original, vocab.titles[original], language);
    return title !== original ? [[original, title]] : [];
  }));
  return { language, names: pick(vocab.names, ids), terms: pick(vocab.terms, ids), units: pick(vocab.units, units), titles };
}

/**
 * Write the public dataset:
 * - catalog.json: everything the grid and filters need
 * - details/NN.json: original lines and parsed ingredients, loaded when a recipe is opened
 * - recipes.full.json: catalog + ingredient lines in one file, for the MCP server
 * - overlay/<lang>.json: the vocabulary each UI language needs to display them
 * - coverage.json: how far each language is from rendering every line and title
 * Recipes the vegan check flags are left out and listed in the report; so are translated editions.
 */
/** `generatedAt` defaults to now; fixtures pin it so regenerating them changes nothing. */
export function emitDataset(all: Recipe[], sources: Source[], outDir: string, { generatedAt = new Date().toISOString(), vocabulary = loadVocabulary(), blocklist = blockedIds }: { generatedAt?: string; vocabulary?: Vocabulary; blocklist?: string[] } = {}): EmitReport {
  const vocab = vocabulary;
  const { published, held, excluded, otherLanguage } = prepareRecipes(all, sources, vocab, blocklist);
  const recipes = published.map((p) => p.recipe);
  const usedSources = sources.filter((s) => recipes.some((r) => r.sourceId === s.id)).map((s) => ({ ...s, contentLanguage: s.contentLanguage ?? 'en' }));
  const parsed = published.map((p) => p.parsed);
  const rows = recipes.map((r, i) => toCatalog(r, parsed[i]!, vocab.byId));
  const used = new Set(rows.flatMap((r) => r.concepts ?? []));
  // Published lookups name concepts only; preparation terms matter while parsing at emit.
  const lookupFor = (language: string) => Object.fromEntries(Object.entries(vocab.lookup(language)).filter(([, id]) => !isTermId(id) && used.has(id)));
  const lookup = lookupFor('en');
  // English concept names keep shopping rows and density conversions stable across source languages.
  const groceryLines = parsed.flatMap((lines, i) => lines.map((p) => recipes[i]!.contentLanguage !== 'en' && p.concept
    ? { ...p, name: vocab.byId.get(p.concept)?.names.en?.filter(Boolean).slice().sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? p.name } : p));
  const grocery = groceryConcepts(groceryLines, vocab.lookup('en'));
  for (const p of groceryLines) if (p.concept && !grocery[p.concept]) grocery[p.concept] = [p.name, aisleFor(p.name)];

  for (const dir of ['details', 'lookup', 'overlay']) {
    fs.rmSync(path.join(outDir, dir), { recursive: true, force: true });
    fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  }

  const catalog: Catalog = { version: 1, generatedAt, dictionary: seed.provenance, sources: usedSources, recipes: rows };
  const full: FullDataset = {
    version: 1,
    generatedAt,
    dictionary: seed.provenance,
    sources: usedSources,
    lookup,
    grocery,
    recipes: rows.map((row, i) => ({ ...row, ingredients: recipes[i]!.ingredients, parsedIngredients: parsed[i]! }))
  };

  const shards: Record<string, { ingredients: string[]; parsedIngredients: ParsedIngredient[] }>[] = Array.from({ length: DETAIL_SHARDS }, () => ({}));
  recipes.forEach((r, i) => { shards[shardOf(r.id)]![r.id] = { ingredients: r.ingredients, parsedIngredients: parsed[i]! }; });

  let bytes = 0;
  const write = (name: string, value: unknown) => {
    const json = JSON.stringify(value);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, name), json);
  };
  const languages = Object.keys(vocab.files);
  for (const language of languages) write(`overlay/${language}.json`, overlay(language, vocab.display(language), rows, parsed));
  const coverage = measureCoverage([...published, ...held], vocab, languages);
  write('coverage.json', coverage);
  write('dictionary.json', { provenance: seed.provenance, concepts: vocab.concepts.filter((c) => used.has(c.id)) });
  for (const language of languages)
    write(`lookup/${language}.json`, { provenance: seed.provenance, aliases: lookupFor(language), ...(language === 'en' ? { grocery } : {}) });
  write('catalog.json', catalog);
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { published: rows.length, held: held.map((p) => p.recipe), excluded, otherLanguage, bySource, bytes, coverage };
}
