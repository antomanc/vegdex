import fs from 'node:fs';
import {
  applyLineRecord, canonicalName, findNonVegan, findNonVeganConcepts, gramsPerCup, ingredientKey, languagePacks, lookupConcept, parseLine,
  type ParsedIngredient, type Recipe, type Source
} from '@vegdex/core';
import { shippedLineRecord } from './line-records';
import { isOtherLanguage } from './sitemap';
import type { Vocabulary } from './vocab';

export const blockedIds: string[] = JSON.parse(fs.readFileSync(new URL('../data/blocklist.json', import.meta.url), 'utf8'));

export interface Prepared {
  recipe: Recipe;
  /** The parts of each line, in line order; most lines are one part. */
  parsed: ParsedIngredient[][];
}

export interface Excluded {
  id: string;
  title: string;
  url: string;
  reason?: 'blocklist' | 'unsupported-language';
  hits: { term: string; line: string; concept?: string }[];
}

/**
 * Parse every stored recipe with the vocabulary and sort it: published, held (a non-English recipe
 * with an ingredient vegdex cannot name yet), or excluded by the blocklist, language or vegan check.
 */
export function prepareRecipes(all: Recipe[], sources: Source[], vocab: Vocabulary, blocklist = blockedIds) {
  const conceptVegan = Object.fromEntries(vocab.concepts.map((c) => [c.id, c.vegan]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const blocked = new Set(blocklist);
  const published: Prepared[] = [];
  const held: Prepared[] = [];
  const excluded: Excluded[] = [];
  let otherLanguage = 0;
  for (const original of all) {
    const source = sourceById.get(original.sourceId);
    if (!source) continue;
    const recipe = { ...original, contentLanguage: source.contentLanguage ?? 'en', ...(source.photosBlocked ? { image: null } : {}) };
    if (blocked.has(recipe.id)) {
      excluded.push({ id: recipe.id, title: recipe.title, url: recipe.url, reason: 'blocklist', hits: [] });
      continue;
    }
    if (isOtherLanguage(recipe.url, recipe.contentLanguage)) {
      otherLanguage++;
      continue;
    }
    if (!Object.hasOwn(languagePacks, recipe.contentLanguage)) {
      excluded.push({ id: recipe.id, title: recipe.title, url: recipe.url, reason: 'unsupported-language', hits: [] });
      continue;
    }
    const lookup = vocab.lookup(recipe.contentLanguage);
    const notIngredients = new Set(vocab.files[recipe.contentLanguage]?.commentary ?? []);
    const parsed = recipe.ingredients.map((line) => applyLineRecord(parseLine(line, lookup, recipe.contentLanguage), shippedLineRecord(recipe.contentLanguage, line), vocab.lookup('en'), { en: vocab.display('en'), it: vocab.display('it') }).map((p): ParsedIngredient => {
      // A fill judged this phrase not an ingredient ("i use this scale").
      if (!p.text && !p.concept && p.name && notIngredients.has(ingredientKey(p.phrase ?? ''))) return { ...p, kind: 'other', name: '' };
      if (recipe.contentLanguage !== 'en' && p.concept) {
        const names = vocab.byId.get(p.concept)?.names.en?.map(canonicalName) ?? [];
        p.densityName = names.find((name) => gramsPerCup(name) !== null);
      }
      return p;
    }));
    const hits = [
      ...findNonVegan(recipe.ingredients, recipe.contentLanguage),
      ...recipe.ingredients.flatMap(line => (shippedLineRecord(recipe.contentLanguage, line)?.parts ?? []).flatMap(part => {
        const concept = lookupConcept(part.en, vocab.lookup('en'));
        return concept && conceptVegan[concept] === 'no' ? [{ term: concept, concept, line }] : [];
      })),
      ...findNonVeganConcepts(recipe.ingredients, lookup, conceptVegan, recipe.contentLanguage).map((hit) => ({ ...hit, term: hit.concept }))
    ];
    if (hits.length) excluded.push({ id: recipe.id, title: recipe.title, url: recipe.url, hits });
    else if (recipe.contentLanguage !== 'en' && parsed.flat().some((p) => p.name && (!p.concept || p.conceptExact !== true))) held.push({ recipe, parsed });
    else published.push({ recipe, parsed });
  }
  published.sort((a, b) => a.recipe.id.localeCompare(b.recipe.id));
  return { published, held, excluded, otherLanguage };
}
