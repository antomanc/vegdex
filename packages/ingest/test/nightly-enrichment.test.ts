import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { emptyLearnedData, emptyQueue } from '../src/enrichment';
import { restoreEnrichment, saveTranslationQueue, updateBacklog, type GhRunner } from '../src/nightly';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
function output() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-nightly-'));
  dirs.push(dir);
  return dir;
}

it('migrates a release with only the crawl store while refusing failed release requests', () => {
  const dir = output();
  restoreEnrichment('antomanc/vegdex', dir, () => JSON.stringify({ assets: [{ name: 'store.json.gz' }, { name: 'excluded.json' }] }));
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'enrichment.json'), 'utf8'))).toEqual(emptyLearnedData());
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'translation-queue.json'), 'utf8')).tasks).toEqual([]);
  fs.writeFileSync(path.join(dir, 'enrichment.json'), 'preserve this file');
  expect(() => restoreEnrichment('antomanc/vegdex', dir, () => { throw new Error('HTTP 403'); })).toThrow('HTTP 403');
  expect(fs.readFileSync(path.join(dir, 'enrichment.json'), 'utf8')).toBe('preserve this file');
});

it('does not replace local state when an advertised enrichment asset fails to download', () => {
  const dir = output();
  fs.writeFileSync(path.join(dir, 'enrichment.json'), JSON.stringify(emptyLearnedData()));
  const before = fs.readFileSync(path.join(dir, 'enrichment.json'), 'utf8');
  const gh: GhRunner = (args) => {
    if (args[0] === 'api') return JSON.stringify({ assets: [{ name: 'enrichment.json' }, { name: 'translation-queue.json' }] });
    if (args.includes('enrichment.json')) {
      fs.writeFileSync(path.join(args[args.indexOf('--dir') + 1]!, 'enrichment.json'), JSON.stringify(emptyLearnedData()));
      return '';
    }
    throw new Error('download failed');
  };
  expect(() => restoreEnrichment('antomanc/vegdex', dir, gh)).toThrow('download failed');
  expect(fs.readFileSync(path.join(dir, 'enrichment.json'), 'utf8')).toBe(before);
  expect(fs.existsSync(path.join(dir, 'translation-queue.json'))).toBe(false);
});

it('restores valid learned data and queue state, then publishes only the newly emitted queue', () => {
  const dir = output();
  const learned = emptyLearnedData();
  learned.titles.it = { Pancakes: 'Pancake' };
  const queue = { ...emptyQueue('2026-10-01T00:00:00.000Z'), issueNumber: 77 };
  const calls: string[][] = [];
  const gh: GhRunner = (args) => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify({ assets: [{ name: 'enrichment.json' }, { name: 'translation-queue.json' }] });
    if (args[1] === 'download') {
      const name = args[args.indexOf('--pattern') + 1]!;
      fs.writeFileSync(path.join(args[args.indexOf('--dir') + 1]!, name), JSON.stringify(name === 'enrichment.json' ? learned : queue));
    }
    return '';
  };
  restoreEnrichment('antomanc/vegdex', dir, gh);
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'enrichment.json'), 'utf8')).titles.it.Pancakes).toBe('Pancake');
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'translation-queue.json'), 'utf8')).issueNumber).toBe(77);
  saveTranslationQueue('antomanc/vegdex', dir, gh);
  const upload = calls.find((args) => args[1] === 'upload')!;
  expect(upload).toContain(path.join(dir, 'translation-queue.json'));
  expect(upload).not.toContain(path.join(dir, 'enrichment.json'));
});

it('updates backlog counts without notifications for old untranslated English recipes', () => {
  const calls: string[][] = [];
  const gh: GhRunner = (args) => {
    calls.push(args);
    return args[1] === 'list' ? JSON.stringify([{ number: 77, title: 'Translation backlog' }]) : '';
  };
  const queue = emptyQueue('2026-10-29T00:00:00.000Z');
  queue.tasks.push({ id: 'title-one', kind: 'title', original: 'Pancakes', sourceLanguage: 'en', targetLanguage: 'it', firstSeen: '2026-01-01T00:00:00.000Z', recipes: [{ id: 'one', title: 'Pancakes' }] });
  const updated = updateBacklog(queue, 'antomanc/vegdex', gh);
  expect(updated.issueNumber).toBe(77);
  expect(calls.some((args) => args[1] === 'edit')).toBe(true);
  expect(calls.some((args) => args[1] === 'comment')).toBe(false);
});

it('never overwrites another issue when a persisted issue number points to the parent spec', () => {
  const calls: string[][] = [];
  const gh: GhRunner = (args) => { calls.push(args); return 'Spec: multi-language vegdex, starting with Italian'; };
  expect(() => updateBacklog({ ...emptyQueue(), issueNumber: 17 }, 'antomanc/vegdex', gh)).toThrow(/backlog/i);
  expect(calls.some((args) => args[1] === 'edit')).toBe(false);
});

it('notifies newly overdue held recipes once and records notification only after success', () => {
  const calls: string[][] = [];
  const gh: GhRunner = (args) => { calls.push(args); return args[1] === 'view' ? 'Translation backlog' : ''; };
  const queue = { ...emptyQueue('2026-10-29T00:00:00.000Z'), issueNumber: 77, held: [
    { id: 'overdue', since: '2026-10-21T00:00:00.000Z' },
    { id: 'exactly-seven-days', since: '2026-10-22T00:00:00.000Z' }
  ] };
  expect(() => updateBacklog(queue, 'antomanc/vegdex', (args) => {
    if (args[1] === 'comment') throw new Error('comment failed');
    return args[1] === 'view' ? 'Translation backlog' : '';
  })).toThrow('comment failed');
  expect(queue.held[0]).not.toHaveProperty('notifiedAt');
  const updated = updateBacklog(queue, 'antomanc/vegdex', gh);
  expect(updated.held[0]!.notifiedAt).toBe('2026-10-29T00:00:00.000Z');
  expect(updated.held[1]).not.toHaveProperty('notifiedAt');
  updateBacklog(updated, 'antomanc/vegdex', gh);
  expect(calls.filter((args) => args[1] === 'comment')).toHaveLength(1);
});

it('uses a successful comment as a receipt if saving notification state failed afterwards', () => {
  let receipt = '';
  let comments = 0;
  const gh: GhRunner = (args, body) => {
    if (args[0] === 'api') return receipt;
    if (args[1] === 'view') return 'Translation backlog';
    if (args[1] === 'comment') { comments++; receipt = body!; }
    return '';
  };
  const queue = { ...emptyQueue('2026-10-29T00:00:00.000Z'), issueNumber: 77,
    held: [{ id: 'overdue', since: '2026-10-01T00:00:00.000Z' }] };
  updateBacklog(queue, 'antomanc/vegdex', gh);
  const retried = updateBacklog(queue, 'antomanc/vegdex', gh);
  expect(comments).toBe(1);
  expect(retried.held[0]!.notifiedAt).toBe('2026-10-29T00:00:00.000Z');
});
