import { ingredientKey, lookupTerm, renderIngredient, safeTranslation, type ParsedIngredient } from '@vegdex/core';
import type { Prepared } from './prepare';
import type { Vocabulary } from './vocab';

/**
 * What the vocabulary still lacks, measured over the catalog:
 * - map: an ingredient phrase in a source language with no concept
 * - term: a note phrase in a source language that is neither a preparation term nor known commentary
 * - name: a concept or term with no name in a display language
 * - title: a recipe title with no translation in a display language
 */
export type GapKind = 'map' | 'term' | 'name' | 'title';

export interface Gap {
  kind: GapKind;
  /** The source language for map and term gaps, the display language for name and title gaps. */
  language: string;
  id: string;
  /** Lines (or recipes, for titles) this gap keeps from rendering. */
  lines: number;
  examples: string[];
}

export interface LanguageCoverage {
  /** Ingredient lines from recipes written in another language. */
  lines: number;
  rendered: number;
  /** No known ingredient: mapping work. */
  unknown: number;
  /** A known ingredient or term without a name here: naming work. */
  unnamed: number;
  /** Shown as written for other reasons, such as "about 2 cups". */
  kept: number;
  titles: number;
  translatedTitles: number;
}

export interface Coverage {
  languages: Record<string, LanguageCoverage>;
  /** The largest gaps per language, by lines affected. */
  top: Record<string, Pick<Gap, 'kind' | 'id' | 'lines'>[]>;
}

const percent = (part: number, whole: number) => whole ? Math.round((1000 * part) / whole) / 10 : 100;
export const score = (c: LanguageCoverage) => ({ rendered: percent(c.rendered, c.lines), unknown: percent(c.unknown, c.lines), titles: percent(c.translatedTitles, c.titles) });

/** Note segments, split the way the parser splits them. */
export function noteSegments(note: string): string[] {
  return note.split(/[,;()]|\s[-–—]\s/).map((s) => s.trim().replace(/[.:]+$/, '')).filter(Boolean);
}

function unmatchedSegments(p: ParsedIngredient, vocab: Vocabulary, language: string): string[] {
  const lookup = vocab.lookup(language);
  const commentary = new Set((vocab.files[language]?.commentary ?? []).map(ingredientKey));
  // Sizes and amounts are parsed, not named; long segments are prose.
  return noteSegments(p.note).filter((s) => !/\d/.test(s) && s.split(/\s+/).length <= 6 && !lookupTerm(s, lookup) && !commentary.has(ingredientKey(s)));
}

const known = (p: ParsedIngredient) => !!p.concept && p.conceptExact === true;

export function findGaps(prepared: Prepared[], vocab: Vocabulary, languages: string[]): Gap[] {
  const gaps = new Map<string, Gap>();
  const add = (kind: GapKind, language: string, id: string, example: string) => {
    const key = `${kind}\0${language}\0${id}`;
    const gap = gaps.get(key) ?? gaps.set(key, { kind, language, id, lines: 0, examples: [] }).get(key)!;
    gap.lines++;
    if (gap.examples.length < 3 && !gap.examples.includes(example)) gap.examples.push(example);
  };
  for (const { recipe, parsed } of prepared) {
    const source = recipe.contentLanguage ?? 'en';
    for (const p of parsed) {
      if (!p.name) continue;
      if (!known(p) && p.phrase) add('map', source, ingredientKey(p.phrase), p.raw);
      for (const segment of unmatchedSegments(p, vocab, source)) add('term', source, ingredientKey(segment), p.raw);
    }
    for (const language of languages) {
      const file = vocab.files[language];
      if (language !== source && !safeTranslation('', file?.titles[recipe.title], language)) add('title', language, recipe.title, recipe.url);
      // Shopping lists name every concept in the page language, whatever language the recipe was written in;
      // English rows use the concepts' own English names.
      if (language === source && language === 'en') continue;
      for (const p of parsed) {
        if (!p.name || !known(p)) continue;
        for (const concept of [p.concept!, p.also?.concept].filter((c): c is string => !!c))
          if (!file?.names[concept] && vocab.byId.get(concept)?.vegan !== 'no') add('name', language, concept, p.raw);
        for (const term of p.terms ?? []) if (!file?.terms[term.id]) add('name', language, term.id, p.raw);
      }
    }
  }
  return [...gaps.values()].sort((a, b) => b.lines - a.lines || a.id.localeCompare(b.id));
}

export function measureCoverage(prepared: Prepared[], vocab: Vocabulary, languages: string[]): Coverage {
  const result: Coverage = { languages: {}, top: {} };
  for (const language of languages) {
    const display = vocab.display(language);
    const c: LanguageCoverage = { lines: 0, rendered: 0, unknown: 0, unnamed: 0, kept: 0, titles: 0, translatedTitles: 0 };
    for (const { recipe, parsed } of prepared) {
      const source = recipe.contentLanguage ?? 'en';
      if (source === language) continue;
      c.titles++;
      if (safeTranslation('', display.titles[recipe.title], language)) c.translatedTitles++;
      for (const p of parsed) {
        c.lines++;
        if (renderIngredient(p, display, language, 'metric', source)) c.rendered++;
        else if (p.name && !known(p)) c.unknown++;
        else if (p.name && (!display.names[p.concept!] || (p.also && !display.names[p.also.concept]) || p.terms?.some((t) => !display.terms[t.id]))) c.unnamed++;
        else c.kept++;
      }
    }
    result.languages[language] = c;
  }
  const gaps = findGaps(prepared, vocab, languages);
  for (const language of languages)
    result.top[language] = gaps.filter((g) => g.language === language).slice(0, 20).map(({ kind, id, lines }) => ({ kind, id, lines }));
  return result;
}
