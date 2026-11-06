import { expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lineKey, type LineRecord, type Recipe, type Source } from '@vegdex/core';
import { answerLines, type FetchLike } from '../src/enrich';
import { applyLineAnswers, fillLines, parseAnswerRows, publishedLines } from '../src/lines-fill';
import { loadLineRecords, writeShard } from '../src/line-records';
import { saveStore } from '../src/store';
import { loadVocabulary } from '../src/vocab';

const source: Source = { id: 'elavegan', name: 'ElaVegan', url: 'https://elavegan.com', contentLanguage: 'en' };
const recipe = (id: string, ingredients: string[]): Recipe => ({
  id, sourceId: 'elavegan', title: id, url: `https://elavegan.com/${id}`, image: null,
  minutes: null, servings: null, rating: null, ratingCount: null, calories: null, protein: null,
  published: null, categories: [], cuisines: [], keywords: [], ingredients
});
const storeOf = (recipes: Recipe[]) => ({ version: 1 as const, urls: {}, recipes: Object.fromEntries(recipes.map((r) => [r.id, r])) });

async function setup(recipes: Recipe[]) {
  const dir = await mkdtemp(join(tmpdir(), 'lines-fill-'));
  const records = join(dir, 'records');
  await mkdir(records, { recursive: true });
  const store = join(dir, 'store.json.gz');
  saveStore(store, storeOf(recipes));
  return { dir, records, store };
}

it('finds distinct published lines with no record and counts uses', () => {
  const vocab = loadVocabulary();
  const published = publishedLines([recipe('a', ['1 cup chickpeas']), recipe('b', ['1 cup chickpeas', '2 cloves garlic'])], [source], vocab);
  const missing = [...published].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  expect(missing.map(([, l]) => l.line)).toEqual(['1 cup chickpeas', '2 cloves garlic']);
  expect(published.get(lineKey('en', '1 cup chickpeas'))?.uses).toBe(2);
});

it('skips a rejected record and keeps the line on the parser path', () => {
  const missing = [{ lang: 'en', line: '1 salt', uses: 1 }];
  const { accepted, report } = applyLineAnswers(missing, new Map(), () => 0, [{ i: 0, p: [{ q: -1, en: 'salt', it: 'sale' }] }], {});
  expect(accepted).toHaveLength(0);
  expect(report.rejected.map((r) => r.reason)).toEqual(['amount']);
});

it('parses JSON Lines answers, tolerating code fences and a JSON array', () => {
  const rows = parseAnswerRows('```json\n{"i":0,"k":"h"}\n{"i":1,"p":[{"en":"salt","it":"sale"}]}\n```');
  expect(rows).toEqual([{ i: 0, k: 'h' }, { i: 1, p: [{ en: 'salt', it: 'sale' }] }]);
  expect(parseAnswerRows('[{"i":0,"k":"o"}]')).toEqual([{ i: 0, k: 'o' }]);
});

it('keeps shard sort order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lines-fill-'));
  try {
    const zeta: LineRecord = { line: '1 zeta', language: 'en', parts: [{ en: 'zeta', it: 'zeta' }] };
    const alpha: LineRecord = { line: '1 alpha', language: 'en', parts: [{ en: 'alpha', it: 'alfa' }] };
    writeShard(dir, '00', [[lineKey('en', '1 zeta'), zeta], [lineKey('en', '1 alpha'), alpha]], 'm');
    const lines = (await readShard(dir, '00')).map((r) => r.line);
    expect(lines).toEqual(['1 alpha', '1 zeta']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('--dry-run reports the count and --limit caps the listing', async () => {
  const { dir, records, store } = await setup([recipe('a', ['1 cup chickpeas']), recipe('b', ['2 cloves garlic']), recipe('c', ['1 tbsp olive oil'])]);
  try {
    const out: string[] = [];
    const summary = await fillLines({ store, records, limit: 2, dryRun: true, model: 'm', log: (m) => out.push(m) });
    expect(summary.missing).toBe(3);
    expect(summary.shown).toBe(2);
    expect(out[0]).toContain('3 catalog lines have no record');
    expect(out).toHaveLength(3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('--answers writes an accepted record into the right shard', async () => {
  const { dir, records, store } = await setup([recipe('a', ['1 cup chickpeas'])]);
  try {
    const answers = join(dir, 'answers.jsonl');
    await writeFile(answers, '{"i":0,"p":[{"q":1,"u":"cup","en":"chickpeas","it":"ceci"}]}\n');
    const summary = await fillLines({ store, records, limit: 10, dryRun: false, answers, model: 'm' });
    expect(summary.accepted).toBe(1);
    expect(loadLineRecords(records).get(lineKey('en', '1 cup chickpeas'))?.parts?.[0]?.it).toBe('ceci');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('fills from a fake endpoint without touching the network', async () => {
  const { dir, records, store } = await setup([recipe('a', ['1 cup chickpeas'])]);
  try {
    const ask = vi.fn(async (_rows: string[]) => '{"i":0,"p":[{"q":1,"u":"cup","en":"chickpeas","it":"ceci"}]}');
    const summary = await fillLines({ store, records, limit: 10, dryRun: false, ask, model: 'm' });
    expect(summary.accepted).toBe(1);
    expect(loadLineRecords(records).get(lineKey('en', '1 cup chickpeas'))?.parts?.[0]?.it).toBe('ceci');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('answerLines posts to the chat endpoint and returns the raw answer', async () => {
  const fake: FetchLike = async (input) => {
    expect(String(input)).toContain('/chat/completions');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"i":0,"k":"h"}' } }] }), { status: 200 });
  };
  await expect(answerLines({ baseURL: 'http://model/v1', model: 'm' }, 'instructions', ['0\ten\t1 salt'], fake)).resolves.toBe('{"i":0,"k":"h"}');
});

async function readShard(dir: string, shard: string) {
  const { readFile } = await import('node:fs/promises');
  return (await readFile(join(dir, `${shard}.jsonl`), 'utf8')).trim().split('\n').slice(1).map((s) => JSON.parse(s) as LineRecord);
}
