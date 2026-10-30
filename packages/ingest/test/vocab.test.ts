import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { lookupConcept, lookupTerm, parseIngredient } from '@vegdex/core';
import { applyAnswers, buildBatch } from '../src/fill';
import { fillPayoff, findGaps, measureCoverage, type Gap } from '../src/gaps';
import type { Prepared } from '../src/prepare';
import { loadVocabulary, writeVocabulary } from '../src/vocab';
import { checkVocabulary } from '../src/vocab-check';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

/** A copy of the committed vocabulary in a temporary directory. */
function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-vocab-'));
  dirs.push(dir);
  fs.cpSync(loadVocabulary().dir, dir, { recursive: true });
  return loadVocabulary(dir);
}

const CHICKPEA = 'off:7ed0f0da39d5b63b';
const BUTTER = loadVocabulary().lookup('en')['butter']!;
const VEGAN_BUTTER = 'veg:0001';

it('keeps the committed vocabulary clean of every problem apply would reject', () => {
  expect(checkVocabulary(loadVocabulary())).toEqual([]);
});

it('parses with taxonomy names, name forms and explicit aliases, keeping terms apart from concepts', () => {
  const vocab = loadVocabulary();
  const en = vocab.lookup('en');
  const it = vocab.lookup('it');
  expect(lookupConcept('chickpeas', en)).toBe(CHICKPEA);
  expect(lookupConcept('ceci', it)).toBe(CHICKPEA);
  expect(lookupConcept('chickpeas', it)).toBe(CHICKPEA); // Italian recipes also write English names.
  expect(lookupTerm('drained and rinsed', en)).toBe('term:drained-rinsed');
  expect(lookupTerm('scolati e sciacquati', it)).toBe('term:drained-rinsed');
  expect(lookupConcept('drained and rinsed', en)).toBeNull();
  expect(parseIngredient('1 can chickpeas, rinsed and drained (see notes)', en).terms).toEqual([{ id: 'term:drained-rinsed', text: 'rinsed and drained' }]);
});

it('gives a name several concepts share to the concept the taxonomy calls that', () => {
  const vocab = scratch();
  vocab.files.it!.names['off:4452df579db4f1b1'] = { one: 'aglio', other: 'aglio', gender: 'm' }; // garlic clove
  expect(lookupConcept('aglio', vocab.lookup('it'))).toBe('off:41024084d2e27b7d');
});

it('finds English plurals and unhyphenated names below every real name', () => {
  const en = loadVocabulary().lookup('en');
  expect(lookupConcept('red grapes', en)).toBe(lookupConcept('red grape', en));
  expect(lookupConcept('red grapes', en)).not.toBeNull();
  expect(lookupConcept('extra firm tofu', en)).toBe(lookupConcept('extra-firm tofu', en));
});

it('lets an explicit alias settle a name the taxonomy leaves ambiguous', () => {
  const vocab = scratch();
  vocab.files.en!.aliases['all-purpose flour'] = 'off:f55f97cfa0dd5f18';
  expect(lookupConcept('all-purpose flour', vocab.lookup('en'))).toBe('off:f55f97cfa0dd5f18');
});

it('applies checked answers for every kind and writes reviewable files', () => {
  const vocab = scratch();
  const items = (ids: string[]) => ids.map((id) => ({ id, lines: 1, examples: [] }));
  const map = applyAnswers(vocab, { kind: 'map', language: 'en', items: items(['garbanzo beans', 'chick peas cooked', 'lunar flour', 'for the sauce', 'mystery', 'moon dust']) }, {
    'garbanzo beans': { concept: CHICKPEA }, 'chick peas cooked': { same: 'chickpea' }, 'lunar flour': { new: { gloss: 'lunar flour', parents: [] } },
    'for the sauce': 'not-ingredient', mystery: null, 'moon dust': { same: 'moon dust powder' }
  });
  expect(map).toEqual({ accepted: 4, skipped: 1, rejected: [{ id: 'moon dust', reason: 'unknown-name' }] });
  const term = applyAnswers(vocab, { kind: 'term', language: 'en', items: items(['finely snipped', 'or tamari', 'cut into dice']) }, {
    'finely snipped': { new: { id: 'term:snipped', name: 'finely snipped' } }, 'or tamari': 'commentary', 'cut into dice': { term: 'term:diced' }
  });
  expect(term).toEqual({ accepted: 3, skipped: 0, rejected: [] });
  const name = applyAnswers(vocab, { kind: 'name', language: 'it', items: items(['vocab:lunar-flour', 'term:snipped']) }, {
    'vocab:lunar-flour': { one: 'farina lunare', other: 'farina lunare', gender: 'f' },
    'term:snipped': { m: 'sminuzzato', f: 'sminuzzata', 'm.pl': 'sminuzzati', 'f.pl': 'sminuzzate' }
  });
  expect(name.accepted).toBe(2);
  expect(applyAnswers(vocab, { kind: 'title', language: 'it', items: items(['5-Minute Hummus']) }, { '5-Minute Hummus': 'Hummus in 5 minuti' }).accepted).toBe(1);
  // Applying the same answer again reuses the concept it created.
  applyAnswers(vocab, { kind: 'map', language: 'en', items: items(['moon flour']) }, { 'moon flour': { new: { gloss: 'Lunar flour', parents: [] } } });
  expect(vocab.added.filter((c) => c.gloss.toLowerCase() === 'lunar flour')).toHaveLength(1);
  applyAnswers(vocab, { kind: 'map', language: 'en', items: items(['boiling chickpeas']) }, { 'boiling chickpeas': { new: { gloss: 'chickpea', parents: [] } } });
  expect(vocab.files.en!.aliases['boiling chickpeas']).toBe(CHICKPEA);
  writeVocabulary(vocab);
  const reloaded = loadVocabulary(vocab.dir);
  expect(checkVocabulary(reloaded)).toEqual([]);
  expect(lookupConcept('lunar flour', reloaded.lookup('en'))).toBe('vocab:lunar-flour');
  expect(lookupConcept('farina lunare', reloaded.lookup('it'))).toBe('vocab:lunar-flour');
  expect(reloaded.files.en!.commentary).toEqual(expect.arrayContaining(['for the sauce', 'or tamari']));
  expect(reloaded.display('it').titles['5-Minute Hummus']).toBe('Hummus in 5 minuti');
  expect(fs.readFileSync(path.join(vocab.dir, 'concepts.json'), 'utf8')).toContain('\n  {"id":"vocab:lunar-flour","gloss":"lunar flour","parents":[]}');
});

it('rejects answers that would lose a qualifier, hide an animal product or break the grammar', () => {
  const vocab = scratch();
  const items = (ids: string[]) => ids.map((id) => ({ id, lines: 1, examples: [] }));
  const map = applyAnswers(vocab, { kind: 'map', language: 'en', items: items(['vegan buttery spread', 'goat cheese', 'smoked bacon bits', 'rice', 'x']) }, {
    'vegan buttery spread': { concept: BUTTER }, 'goat cheese': { concept: CHICKPEA },
    'smoked bacon bits': { new: { gloss: 'smoked bacon bits', parents: [] } }, rice: { concept: 'off:does-not-exist' }, unasked: { concept: CHICKPEA }
  });
  expect(map.rejected.map((r) => r.reason)).toEqual(['qualification-lost', 'unsafe', 'unsafe', 'unknown-concept', 'unknown-item']);
  const name = applyAnswers(vocab, { kind: 'name', language: 'it', items: items([VEGAN_BUTTER, CHICKPEA, BUTTER, 'term:diced']) }, {
    [VEGAN_BUTTER]: { one: 'burro', other: 'burro', gender: 'm' },
    [CHICKPEA]: { one: 'cece', other: 'ceci' },
    [BUTTER]: { one: 'burro', other: 'burro', gender: 'm' },
    'term:diced': 'a dadini'
  });
  expect(name.rejected.map((r) => r.reason)).toEqual(['unsafe', 'gender', 'animal-concept', 'malformed']);
  expect(applyAnswers(vocab, { kind: 'title', language: 'it', items: items(['5-Minute Hummus']) }, { '5-Minute Hummus': 'Hummus veloce' }).rejected[0]!.reason).toBe('quantity-changed');
  expect(checkVocabulary(vocab)).toEqual([]);
});

it('measures coverage and ranks gaps by the lines they keep from rendering', () => {
  const vocab = loadVocabulary();
  const recipe = (id: string, ingredients: string[], contentLanguage = 'en') => ({
    recipe: { id, sourceId: 's', title: `Title ${id}`, url: `https://example.com/${id}`, image: null, minutes: null, servings: null, rating: null,
      ratingCount: null, calories: null, protein: null, published: null, categories: [], cuisines: [], keywords: [], ingredients, contentLanguage },
    parsed: ingredients.map((line) => parseIngredient(line, vocab.lookup(contentLanguage), contentLanguage))
  }) satisfies Prepared;
  const prepared = [
    recipe('a', ['400 g chickpeas, drained and rinsed', '1 cup mystery seeds', '2 tbsp moon oil']),
    recipe('b', ['1 cup mystery seeds, see notes', '1 tsp moon salt'])
  ];
  const { coverage, gaps } = measureCoverage(prepared, vocab, ['it']);
  expect(coverage.languages.it).toMatchObject({ lines: 5, rendered: 1, unknown: 4, titles: 2, translatedTitles: 0 });
  expect(gaps).toEqual(findGaps(prepared, vocab, ['it']));
  expect(gaps.filter((g) => g.kind === 'map').map((g) => [g.id, g.lines])).toEqual([['mystery seeds', 2], ['moon oil', 1], ['moon salt', 1]]);
  expect(gaps.filter((g) => g.kind === 'title')).toHaveLength(2);
  const batch = buildBatch(vocab, gaps, 'map', 'en', 1);
  expect(batch.items).toEqual([expect.objectContaining({ id: 'mystery seeds', lines: 2, context: expect.objectContaining({ candidates: expect.any(Array) }) })]);
  expect(batch.instructions).toContain('"not-ingredient"');
});

it('sizes fill payoff by the largest gaps, stopping at the first size that takes them all', () => {
  const gaps = [50, 30, 20, 10, 5, 5].map((lines, i): Gap => ({ kind: 'map', language: 'en', id: `g${i}`, lines, examples: [] }));
  expect(fillPayoff(gaps, [2, 4, 10, 25])).toEqual([{ gaps: 2, lines: 80 }, { gaps: 4, lines: 110 }, { gaps: 6, lines: 120 }]);
  expect(fillPayoff(gaps, [6, 10])).toEqual([{ gaps: 6, lines: 120 }]);
  expect(fillPayoff([], [10])).toEqual([]);
});

it('drops a curated brand only where no ingredient shares its name', () => {
  const vocab = scratch();
  vocab.files.en!.brands.push('chickpea');
  expect(lookupConcept('chickpea', vocab.lookup('en'))).toBe(CHICKPEA);
  expect(parseIngredient("1 cup Bob's Red Mill almond flour", loadVocabulary().lookup('en')).conceptExact).toBe(true);
});

it('reports a concept that duplicates another and a shown name search cannot find', () => {
  const vocab = scratch();
  vocab.added.push({ id: 'vocab:chickpea-again', gloss: 'chickpea', parents: [] });
  vocab.files.it!.names['off:4452df579db4f1b1'] = { one: 'cece magico', other: 'ceci magici', gender: 'm' };
  vocab.files.it!.names['off:41024084d2e27b7d'] = { one: 'cece magico', other: 'ceci magici', gender: 'm' };
  const problems = checkVocabulary(vocab);
  expect(problems).toContain(`vocab:chickpea-again: gloss is already ${CHICKPEA}`);
  expect(problems.some((p) => p.includes('"cece magico": ambiguous'))).toBe(true);
});
