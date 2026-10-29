import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ingredientKey, isTermId, languagePacks, type IngredientLookup, type LanguageVocabulary, type NounForms, type TermForms
} from '@vegdex/core';
import { seed, type Concept } from './concepts';

/**
 * Everything vegdex knows about one language, kept in git as data/vocab/<lang>.json:
 * how its words map to concepts and preparation terms, and how to write those back out.
 */
export interface VocabFile {
  /** Phrase → concept or term ID, beyond the names below and the taxonomy's own names. */
  aliases: Record<string, string>;
  names: Record<string, NounForms>;
  terms: Record<string, TermForms>;
  /** Curated unit labels, never model-generated. */
  units: Record<string, [singular: string, plural: string]>;
  titles: Record<string, string>;
  /** Note phrases judged not essential, so they are not proposed again. */
  commentary: string[];
}

/** A concept the taxonomy lacks, named only in the language files. Its vegan status is always unknown. */
export interface VocabConcept {
  id: string;
  /** English description for people and models reading the file. */
  gloss: string;
  parents: string[];
}

export interface Vocabulary {
  dir: string;
  concepts: Concept[];
  byId: Map<string, Concept>;
  added: VocabConcept[];
  files: Record<string, VocabFile>;
  /** Parsing aliases for recipes written in `language`. */
  lookup(language: string): IngredientLookup;
  display(language: string): LanguageVocabulary;
}

export const vocabDir = fileURLToPath(new URL('../data/vocab/', import.meta.url));

export const emptyVocabFile = (): VocabFile => ({ aliases: {}, names: {}, terms: {}, units: {}, titles: {}, commentary: [] });

export function readVocabFile(file: string): VocabFile {
  if (!fs.existsSync(file)) return emptyVocabFile();
  return { ...emptyVocabFile(), ...JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<VocabFile> };
}

/** All forms a name or term is written in. */
function forms(value: NounForms | TermForms): string[] {
  if (typeof value === 'string') return [value];
  if ('one' in value && 'other' in value) return [value.one, value.other];
  return Object.values(value).filter((v): v is string => typeof v === 'string');
}

export function loadVocabulary(dir = vocabDir): Vocabulary {
  const added = fs.existsSync(path.join(dir, 'concepts.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'concepts.json'), 'utf8')) as VocabConcept[] : [];
  const languages = new Set([...Object.keys(languagePacks), ...fs.readdirSync(dir).filter((f) => /^[a-z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2))]);
  const files = Object.fromEntries([...languages].map((language) => [language, readVocabFile(path.join(dir, `${language}.json`))]));
  const concepts: Concept[] = [...seed.concepts.map((c) => ({ ...c, names: { ...c.names } })),
    ...added.map((c): Concept => ({ id: c.id, names: {}, parents: c.parents, vegan: 'unknown' }))];
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const seedNames = new Map(seed.concepts.map((c) => [c.id, c.names]));
  // Names and aliases in the language files also name their concept, for search, tags and the public dictionary.
  for (const [language, file] of Object.entries(files)) {
    const extra = new Map<string, string[]>();
    for (const [id, value] of Object.entries(file.names)) extra.set(id, forms(value).map(ingredientKey));
    for (const [alias, id] of Object.entries(file.aliases)) if (!isTermId(id)) extra.set(id, [...extra.get(id) ?? [], ingredientKey(alias)]);
    for (const [id, names] of extra) {
      const concept = byId.get(id);
      if (concept) concept.names[language] = [...new Set([...concept.names[language] ?? [], ...names])];
    }
  }
  const lookups = new Map<string, IngredientLookup>();
  const lookup = (language: string): IngredientLookup => {
    const cached = lookups.get(language);
    if (cached) return cached;
    // Names first, ambiguous ones dropped; then explicit aliases, which settle any ambiguity on purpose.
    const owners = new Map<string, Set<string>>();
    const own = (name: string, id: string) => {
      const key = ingredientKey(name);
      (owners.get(key) ?? owners.set(key, new Set()).get(key)!).add(id);
    };
    const nameLanguages = language === 'en' ? ['en'] : ['en', language];
    for (const c of concepts) for (const l of nameLanguages) for (const name of c.names[l] ?? []) own(name, c.id);
    for (const l of nameLanguages) for (const [id, value] of Object.entries(files[l]?.terms ?? {})) for (const form of forms(value)) own(form, id);
    // A name several concepts share belongs to the one the taxonomy itself calls that ("aglio" is garlic, not garlic clove).
    const taxonomy = (id: string, key: string) => nameLanguages.some((l) => seedNames.get(id)?.[l]?.includes(key));
    const result: IngredientLookup = Object.create(null);
    for (const [key, ids] of owners) {
      const owner = ids.size === 1 ? [...ids] : [...ids].filter((id) => taxonomy(id, key));
      if (owner.length === 1) result[key] = owner[0]!;
    }
    for (const l of nameLanguages) for (const [alias, id] of Object.entries(files[l]?.aliases ?? {})) result[ingredientKey(alias)] = id;
    lookups.set(language, result);
    return result;
  };
  const display = (language: string): LanguageVocabulary => {
    const file = files[language] ?? emptyVocabFile();
    return { language, names: file.names, terms: file.terms, units: file.units, titles: file.titles };
  };
  return { dir, concepts, byId, added, files, lookup, display };
}

/** Sorted keys, one entry per line: vocabulary diffs stay reviewable. */
function stable(value: unknown, indent = ''): string {
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => `${indent}  ${JSON.stringify(v)}`).join(',\n')}\n${indent}]` : '[]';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${indent ? JSON.stringify(v) : stable(v, `${indent}  `)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export function writeVocabulary(vocab: Vocabulary): void {
  fs.mkdirSync(vocab.dir, { recursive: true });
  for (const [language, file] of Object.entries(vocab.files)) {
    const empty = Object.values(file).every((v) => Array.isArray(v) ? !v.length : !Object.keys(v).length);
    if (empty && !fs.existsSync(path.join(vocab.dir, `${language}.json`))) continue;
    writeAtomic(path.join(vocab.dir, `${language}.json`), stable({ ...file, commentary: [...new Set(file.commentary)].sort() }) + '\n');
  }
  const added = [...vocab.added].sort((a, b) => a.id.localeCompare(b.id));
  writeAtomic(path.join(vocab.dir, 'concepts.json'), (added.length ? `[\n${added.map((c) => `  ${JSON.stringify(c)}`).join(',\n')}\n]` : '[]') + '\n');
}

export function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, text);
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}
