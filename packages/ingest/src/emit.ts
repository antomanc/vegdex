import {
  classify,
  toMetric,
  safeTranslation,
  DETAIL_SHARDS,
  shardOf,
  type Catalog,
  groceryConcepts,
  packCatalog,
  ratingScore,
  aisleFor,
  isTermId,
  searchRecipes,
  type CatalogRecipe,
  type FullDataset,
  type LanguageVocabulary,
  type Recipe,
  type ParsedIngredient,
  type ParsedLine,
  type Source
} from '@vegdex/core';
import { normalizeTitle } from './titles';
import fs from 'node:fs';
import path from 'node:path';
import { conceptFamily, seed, type Concept } from './concepts';
import { measureCoverage, type Coverage } from './gaps';
import { blockedIds, prepareRecipes, type Excluded } from './prepare';
import { loadVocabulary, type Vocabulary } from './vocab';

/** Two screens of cards: enough for the first page in any UI language. */
const FIRST_PAGE = 96;

function toCatalog(r: Recipe, lines: ParsedIngredient[][], concepts: Map<string, Concept>): CatalogRecipe {
  const parsed = lines.flat();
  const ing = [...new Set(parsed.flatMap((p) => [p.name, p.also?.name ?? '']).filter(Boolean))];
  const ingredientNames = r.contentLanguage === 'en' ? undefined : parsed.map((p) => p.concept
    ? conceptFamily([p.concept], concepts).flatMap((id) => concepts.get(id)?.names.en ?? []).join(' | ') : '');
  return {
    contentLanguage: r.contentLanguage ?? 'en',
    concepts: conceptFamily(parsed.flatMap((p) => [p.concept, p.also?.concept].filter((c): c is string => !!c)), concepts),
    id: r.id,
    title: normalizeTitle(r.title, r.contentLanguage ?? 'en'),
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
function overlay(language: string, vocab: LanguageVocabulary, recipes: Recipe[], parsed: ParsedIngredient[][][]): LanguageVocabulary {
  const lines = parsed.flat(2);
  const ids = new Set(lines.flatMap((p) => [p.concept, p.also?.concept, ...(p.terms ?? []).map((t) => t.id)].filter((id): id is string => !!id)));
  const units = new Set(lines.flatMap((p) => {
    const metric = toMetric(p);
    return [p.unit, p.size?.unit, metric?.unit, metric && metric.unit !== 'cm' && Math.max(metric.quantity, metric.quantityMax ?? 0) >= 1000 ? (metric.unit === 'g' ? 'kg' : 'l') : null]
      .filter((u): u is string => !!u);
  }));
  const pick = <T>(table: Record<string, T>, used: Set<string>) => Object.fromEntries(Object.entries(table).filter(([key]) => used.has(key)));
  const titles = Object.fromEntries([...recipes].sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0).flatMap((recipe) => {
    // Vocabulary keys remain the original source titles, including in gaps and coverage.
    const original = recipe.title;
    const title = safeTranslation(original, vocab.titles[original], language);
    return title !== original ? [[normalizeTitle(original, recipe.contentLanguage ?? 'en'), normalizeTitle(title, language)]] : [];
  }));
  return { language, names: pick(vocab.names, ids), terms: pick(vocab.terms, ids), units: pick(vocab.units, units), titles };
}

/**
 * Write the public dataset:
 * - catalog.json: everything the grid and filters need (packed, see packCatalog)
 * - first.json: the best-rated recipes, shown while catalog.json loads
 * - details/NN.json: original lines and parsed ingredients, loaded when a recipe is opened
 * - recipes.full.json: catalog + ingredient lines in one file, for the MCP server
 * - overlay/<lang>.json: the vocabulary each UI language needs to display them
 * - suggest/<lang>.json: ingredient names the filter inputs suggest, most used first
 * - coverage.json: how far each language is from rendering every line and title
 * Recipes the vegan check flags are left out and listed in the report; so are translated editions.
 */
/** `generatedAt` defaults to now; fixtures pin it so regenerating them changes nothing. */
/** Shopping-list row names that win over the computed ones, for rows the catalog names from a typo or an odd spelling. */
const groceryNameTable: Record<string, string> = JSON.parse(fs.readFileSync(new URL('../data/grocery-names.json', import.meta.url), 'utf8'));

export function emitDataset(all: Recipe[], sources: Source[], outDir: string, { generatedAt = new Date().toISOString(), vocabulary = loadVocabulary(), blocklist = blockedIds, groceryNames = groceryNameTable }: { generatedAt?: string; vocabulary?: Vocabulary; blocklist?: string[]; groceryNames?: Record<string, string> } = {}): EmitReport {
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
  const groceryLines = parsed.flatMap((lines, i) => lines.flat().map((p) => recipes[i]!.contentLanguage !== 'en' && p.concept
    ? { ...p, name: vocab.byId.get(p.concept)?.names.en?.filter(Boolean).slice().sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? p.name } : p));
  const grocery = groceryConcepts(groceryLines, vocab.lookup('en'));
  for (const p of groceryLines) if (p.concept && !grocery[p.concept]) grocery[p.concept] = [p.name, aisleFor(p.name)];
  for (const [id, name] of Object.entries(groceryNames)) {
    if (!vocab.byId.has(id)) throw new Error(`grocery-names.json: unknown concept ${id}`);
    if (grocery[id]) grocery[id] = [name, grocery[id][1]];
  }

  // A line ships as its one part, or as an array of parts, so most detail entries keep their old shape.
  const shipped = parsed.map((lines) => lines.map((parts): ParsedLine => (parts.length === 1 ? parts[0]! : parts)));

  // One name per ingredient the lines use, most used first, for the Must include and Avoid inputs to suggest.
  const recipesUsing = new Map<string, number>();
  for (const lines of parsed)
    for (const id of new Set(lines.flat().flatMap((p) => [p.concept, p.also?.concept]))) if (id) recipesUsing.set(id, (recipesUsing.get(id) ?? 0) + 1);
  const byUse = [...recipesUsing].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
  const suggestions = (language: string) => {
    const aliases = lookupFor(language);
    const names = vocab.display(language).names;
    // English uses the shopping-list names; other languages the names their lines are shown with.
    const shown = new Set(byUse.map((id) => (language === 'en' ? grocery[id]?.[0] : names[id]?.other)));
    // Picking a suggestion must leave some recipes.
    return [...shown].filter((name): name is string => !!name && searchRecipes(rows, { include: [name] }, aliases).length > 0);
  };

  for (const dir of ['details', 'lookup', 'overlay', 'suggest']) {
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
    recipes: rows.map((row, i) => ({ ...row, ingredients: recipes[i]!.ingredients, parsedIngredients: shipped[i]! }))
  };

  const shards: Record<string, { ingredients: string[]; parsedIngredients: ParsedLine[] }>[] = Array.from({ length: DETAIL_SHARDS }, () => ({}));
  recipes.forEach((r, i) => { shards[shardOf(r.id)]![r.id] = { ingredients: r.ingredients, parsedIngredients: shipped[i]! }; });

  let bytes = 0;
  const write = (name: string, value: unknown) => {
    const json = JSON.stringify(value);
    bytes += json.length;
    fs.writeFileSync(path.join(outDir, name), json);
  };
  const languages = Object.keys(vocab.files);
  for (const language of languages) write(`overlay/${language}.json`, overlay(language, vocab.display(language), recipes, parsed));
  const { coverage } = measureCoverage([...published, ...held], vocab, languages);
  write('coverage.json', coverage);
  write('dictionary.json', { provenance: seed.provenance, concepts: vocab.concepts.filter((c) => used.has(c.id)) });
  for (const language of languages)
    write(`lookup/${language}.json`, { provenance: seed.provenance, aliases: lookupFor(language), ...(language === 'en' ? { grocery } : {}) });
  for (const language of languages) write(`suggest/${language}.json`, suggestions(language));
  // Packed: each concept, ingredient name and tag once, and only the concepts a family does not imply.
  write('catalog.json', packCatalog(catalog, (id) => vocab.byId.get(id)?.parents ?? []));
  // The best-rated recipes, a few kilobytes: a plain landing shows them while catalog.json downloads.
  const first = [...rows].sort((a, b) => ratingScore(b) - ratingScore(a)).slice(0, FIRST_PAGE);
  const firstSources = usedSources.filter((s) => first.some((r) => r.source === s.id));
  write('first.json', packCatalog({ ...catalog, sources: firstSources, recipes: first }, (id) => vocab.byId.get(id)?.parents ?? []));
  write('recipes.full.json', full);
  shards.forEach((shard, i) => write(`details/${String(i).padStart(2, '0')}.json`, shard));

  const bySource: Record<string, number> = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { published: rows.length, held: held.map((p) => p.recipe), excluded, otherLanguage, bySource, bytes, coverage };
}
