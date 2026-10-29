import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  canonicalName, findUnsafeRenderedTerms, ingredientKey, ingredientNote, isQualifiedIngredient,
  safeTranslation, type IngredientLookup, type IngredientTables,
  type ParsedIngredient, type Recipe, type TranslationMemory
} from '@vegdex/core';
import { seed, usedLookup, type Concept } from './concepts';

/** Release asset shared by nightly emit and the manual enrich command. */
export interface LearnedData {
  version: 1;
  titles: TranslationMemory;
  concepts: Concept[];
  aliases: Record<string, IngredientLookup>;
  ingredientTables: Record<string, IngredientTables>;
}

export interface QueueTask {
  id: string;
  kind: 'title' | 'ingredient' | 'note';
  original: string;
  sourceLanguage: string;
  targetLanguage: string;
  firstSeen: string;
  concept?: string;
  recipes: { id: string; title: string; line?: string }[];
}

export interface HeldRecipe {
  id: string;
  since: string;
  notifiedAt?: string;
}

export interface TranslationQueue {
  version: 1;
  generatedAt: string;
  tasks: QueueTask[];
  held: HeldRecipe[];
  issueNumber?: number;
}

export function emptyLearnedData(): LearnedData {
  return { version: 1, titles: {}, concepts: [], aliases: {}, ingredientTables: {} };
}

export function emptyQueue(now = new Date().toISOString()): TranslationQueue {
  return { version: 1, generatedAt: now, tasks: [], held: [] };
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const strings = (value: unknown): value is Record<string, string> => record(value) && Object.values(value).every(text);
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const tablesShape = (value: unknown): value is IngredientTables => record(value) && strings(value.names) && strings(value.notes) &&
  record(value.units) && Object.values(value.units).every((unit) => Array.isArray(unit) && unit.length === 2 && unit.every(text));

/** Validate persisted files before using any entry as parsing or display data. */
export function validateLearnedData(value: unknown): LearnedData {
  if (!record(value) || value.version !== 1 || !record(value.titles) || !Object.values(value.titles).every(strings) ||
    !record(value.aliases) || !Object.values(value.aliases).every(strings) ||
    !record(value.ingredientTables) || !Object.values(value.ingredientTables).every(tablesShape) || !Array.isArray(value.concepts) ||
    !value.concepts.every((c) => record(c) && text(c.id) && record(c.names) && Object.values(c.names).every((names) => Array.isArray(names) && names.every(text)) &&
      Array.isArray(c.parents) && c.parents.every(text) && ['yes', 'no', 'maybe', 'unknown'].includes(String(c.vegan))) ||
    new Set(value.concepts.map((c) => c.id)).size !== value.concepts.length)
    throw new Error('Invalid enrichment data');
  return value as unknown as LearnedData;
}

export function validateTranslationQueue(value: unknown): TranslationQueue {
  if (!record(value) || value.version !== 1 || !timestamp(value.generatedAt) || !Array.isArray(value.tasks) || !Array.isArray(value.held) ||
    (value.issueNumber !== undefined && (!Number.isInteger(value.issueNumber) || Number(value.issueNumber) <= 0)) ||
    !value.tasks.every((task) => record(task) && text(task.id) && ['title', 'ingredient', 'note'].includes(String(task.kind)) &&
      text(task.original) && text(task.sourceLanguage) && text(task.targetLanguage) && timestamp(task.firstSeen) &&
      (task.concept === undefined || text(task.concept)) && Array.isArray(task.recipes) && task.recipes.every((r) => record(r) && text(r.id) && text(r.title) && (r.line === undefined || text(r.line)))) ||
    !value.held.every((held) => record(held) && text(held.id) && timestamp(held.since) && (held.notifiedAt === undefined || timestamp(held.notifiedAt))))
    throw new Error('Invalid translation queue');
  return value as unknown as TranslationQueue;
}

function readData<T>(file: string, validate: (value: unknown) => T, initial: () => T): T {
  try {
    return validate(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return initial();
    throw error;
  }
}

export const readLearnedData = (file: string) => readData(file, validateLearnedData, emptyLearnedData);
export const readTranslationQueue = (file: string) => readData(file, validateTranslationQueue, emptyQueue);

export function writeJSONAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

export function learnedConceptId(original: string): string {
  return `learned:${createHash('sha256').update(original.normalize('NFC').toLowerCase().trim()).digest('hex').slice(0, 16)}`;
}

/** Learned aliases may add synonyms, never a shortened alternative, purpose or size phrase. */
function wholeAlias(alias: string): boolean {
  if (/[,;()/]|\b(?:or|and|with|for|optional|small|medium|large|extra|baby|big|fat|jumbo|mini|whole|half|chopped|diced|minced|sliced|halved|quartered|peeled|grated|crushed|ground|fresh|frozen|dried|to|taste|as|needed|desired|divided|plus)\b/i.test(alias)) return false;
  const original = ingredientKey(alias);
  const canonical = canonicalName(alias);
  return original === canonical || original === `${canonical}s` || original === `${canonical}es` || isQualifiedIngredient(alias);
}

export function mergeEnrichment(learned: LearnedData, titles: TranslationMemory, tables: Record<string, IngredientTables>) {
  validateLearnedData(learned);
  const seedIds = new Set(seed.concepts.map((c) => c.id));
  const reservedNames = new Set(seed.concepts.flatMap((c) => Object.values(c.names).flat().map(ingredientKey)));
  const additions = learned.concepts.filter((c) => {
    const original = c.names.en?.[0];
    return original && !seedIds.has(c.id) && c.id === learnedConceptId(original) && wholeAlias(original) &&
      !reservedNames.has(ingredientKey(original)) && c.parents.every((id) => seedIds.has(id)) &&
      c.parents.every((id) => seed.concepts.find((parent) => parent.id === id)?.vegan !== 'no') &&
      Object.entries(c.names).every(([language, names]) => names.every((name) => !findUnsafeRenderedTerms(name, language).length));
  });
  // Model claims of vegan status never become publication evidence.
  const concepts = [...seed.concepts, ...additions.map((c): Concept => ({ ...c, vegan: 'unknown' }))];
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const languages = new Set(['en', ...Object.keys(titles), ...Object.keys(tables)]);
  const aliases: Record<string, IngredientLookup> = {};
  const ingredientTables: Record<string, IngredientTables> = {};
  const translations: TranslationMemory = {};
  for (const language of languages) {
    const committed = usedLookup(language);
    const learnedAliases = { ...usedLookup(language, undefined, additions), ...learned.aliases[language] };
    aliases[language] = Object.fromEntries(Object.entries(learnedAliases).filter(([alias, id]) => {
      const concept = byId.get(id);
      if (!concept || reservedNames.has(ingredientKey(alias)) || !wholeAlias(alias)) return false;
      if (isQualifiedIngredient(alias) && (concept.vegan === 'no' || !concept.names.en?.some(isQualifiedIngredient))) return false;
      return true;
    }).map(([alias, id]) => [ingredientKey(alias), id]));
    Object.assign(aliases[language]!, committed);
    const learnedTables = learned.ingredientTables[language];
    const names = Object.fromEntries(concepts.flatMap((c) => c.names[language]?.[0] ? [[c.id, c.names[language]![0]!]] : []));
    const safeNames = Object.fromEntries(Object.entries(learnedTables?.names ?? {}).filter(([id, name]) => byId.has(id) && !findUnsafeRenderedTerms(name, language).length));
    const safeNotes = Object.fromEntries(Object.entries(learnedTables?.notes ?? {}).filter(([, note]) => !findUnsafeRenderedTerms(note, language).length));
    if (tables[language] || learnedTables) ingredientTables[language] = {
      names: { ...safeNames, ...names, ...tables[language]?.names },
      notes: { ...safeNotes, ...tables[language]?.notes },
      // Units are curated language data, never model-generated conversions.
      units: { ...tables[language]?.units }
    };
    translations[language] = { ...learned.titles[language], ...titles[language] };
  }
  return { concepts, byId, aliases, titles: translations, ingredientTables };
}

export function buildTranslationQueue(
  recipes: Recipe[], parsed: ParsedIngredient[][], titles: TranslationMemory,
  tables: Record<string, IngredientTables>, now: string, previous = emptyQueue(now)
): TranslationQueue {
  const tasks = new Map<string, QueueTask>();
  const firstSeen = new Map(previous.tasks.map((task) => [task.id, task.firstSeen]));
  const languages = new Set([...Object.keys(titles), ...Object.keys(tables)]);
  const add = (kind: QueueTask['kind'], original: string, r: Recipe, targetLanguage: string, p?: ParsedIngredient) => {
    const sourceLanguage = r.contentLanguage ?? 'en';
    const id = createHash('sha256').update(JSON.stringify([kind, original, sourceLanguage, targetLanguage])).digest('hex');
    let task = tasks.get(id);
    if (!task) {
      task = { id, kind, original, sourceLanguage, targetLanguage, firstSeen: firstSeen.get(id) ?? now,
        ...(p?.concept ? { concept: p.concept } : {}), recipes: [] };
      tasks.set(id, task);
    }
    if (!task.recipes.some((context) => context.id === r.id && context.line === p?.raw))
      task.recipes.push({ id: r.id, title: r.title, ...(p ? { line: p.raw } : {}) });
  };
  recipes.forEach((r, index) => {
    for (const language of languages) {
      if (language === (r.contentLanguage ?? 'en')) continue;
      const candidate = titles[language]?.[r.title];
      if (!candidate || safeTranslation(r.title, candidate, language) !== candidate.trim()) add('title', r.title, r, language);
      for (const p of parsed[index] ?? []) {
        if (!p.name) continue;
        const name = p.concept && tables[language]?.names[p.concept];
        if (!p.concept || !p.conceptExact || !name || safeTranslation('', name, language) !== name)
          add('ingredient', p.sourceName || p.name, r, language, p);
        const note = ingredientNote(p);
        const translated = note && tables[language]?.notes[note];
        if (note && (!translated || safeTranslation('', translated, language) !== translated)) add('note', note, r, language, p);
      }
    }
  });
  return { version: 1, generatedAt: now, tasks: [...tasks.values()].sort((a, b) => a.id.localeCompare(b.id)),
    // English recipes are never held. Phase 4 supplies held records when it adds non-English sources.
    held: [], ...(previous.issueNumber ? { issueNumber: previous.issueNumber } : {}) };
}
