import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { emptyLearnedData, emptyQueue, readLearnedData, readTranslationQueue, writeJSONAtomic, type LearnedData, type QueueTask, type TranslationQueue } from '../src/enrichment';
import { runRemoteEnrich } from '../src/remote-enrich';
import type { GhRunner } from '../src/nightly';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

const dirs: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); })));
  dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});
const task = (original = 'Weeknight Chickpea Bowl', id = 'title-one'): QueueTask => ({
  id, kind: 'title', original, sourceLanguage: 'en', targetLanguage: 'it', firstSeen: '2026-10-01T00:00:00.000Z', recipes: [{ id: 'one', title: original }]
});
function files() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-remote-enrich-'));
  dirs.push(dir);
  return { queueFile: path.join(dir, 'translation-queue.json'), learnedFile: path.join(dir, 'enrichment.json') };
}
async function endpoint(reply: (input: { original: string }) => unknown) {
  let requests = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests++;
    const request = JSON.parse(body);
    const answer = reply(JSON.parse(request.messages[1].content));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { model: { baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, model: 'fixture-model' }, requests: () => requests };
}
function remote(queue: TranslationQueue, learned = emptyLearnedData()) {
  const state = { queue, learned };
  const events: string[][] = [];
  const failures = { upload: '', dispatch: false, download: false };
  const gh: GhRunner = (args) => {
    events.push(args);
    if (failures.download && (args[0] === 'api' || args[1] === 'download')) throw new Error('provider-secret: download failed');
    if (args[0] === 'api') return JSON.stringify({ assets: [{ name: 'enrichment.json' }, { name: 'translation-queue.json' }] });
    if (args[1] === 'download') {
      const name = args[args.indexOf('--pattern') + 1]!;
      fs.writeFileSync(path.join(args[args.indexOf('--dir') + 1]!, name), JSON.stringify(name === 'enrichment.json' ? state.learned : state.queue));
    } else if (args[1] === 'upload') {
      const name = path.basename(args[3]!);
      if (failures.upload === name) throw new Error('provider-secret: upload failed');
      const value = JSON.parse(fs.readFileSync(args[3]!, 'utf8'));
      if (name === 'enrichment.json') state.learned = value as LearnedData;
      else state.queue = value as TranslationQueue;
    } else if (args[0] === 'workflow' && failures.dispatch) throw new Error('provider-secret: dispatch failed');
    return '';
  };
  return { state, events, gh, failures };
}

it('publishes learned data before the queue and triggers a deployment without crawling', async () => {
  const state = files();
  const entry = task();
  const github = remote({ ...emptyQueue(), tasks: [entry] });
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  const report = await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh });
  expect(report).toMatchObject({ accepted: 1, remaining: 0, failed: [], deployment: 'triggered' });
  const uploads = github.events.filter((args) => args[1] === 'upload');
  expect(uploads.map((args) => path.basename(args[3]!))).toEqual(['enrichment.json', 'translation-queue.json']);
  expect(github.events.at(-1)).toEqual(['workflow', 'run', 'daily.yml', '--repo', 'antomanc/vegdex', '--raw-field', 'crawl=false']);
  expect(github.state.learned.titles.it?.[entry.original]).toBe('Ciotola di ceci per la sera');
  expect(github.state.queue.tasks).toEqual([]);
  const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
  const out = path.join(path.dirname(state.queueFile), 'public');
  emitDataset([{ ...base, title: entry.original }], [{ id: base.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' }], out, { learnedData: github.state.learned });
  expect(JSON.parse(fs.readFileSync(path.join(out, 'overlay/it.json'), 'utf8')).titles[entry.original]).toBe('Ciotola di ceci per la sera');
});

it.each(['enrichment.json', 'translation-queue.json'])('keeps accepted work after a failed %s upload and reuses it on retry', async (asset) => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task()] });
  github.failures.upload = asset;
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  const options = { ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh };
  await expect(runRemoteEnrich(options)).rejects.toThrow('Accepted work remains saved locally');
  expect(readLearnedData(state.learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  expect(github.events.some((args) => args[0] === 'workflow')).toBe(false);
  github.failures.upload = '';
  const retry = await runRemoteEnrich(options);
  expect(retry).toMatchObject({ accepted: 0, reused: 1, remaining: 0, deployment: 'triggered' });
  expect(fake.requests()).toBe(1);
});

it('merges newly published entries and preserves queue work added while the model runs', async () => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task()] });
  const fresh = task('Fresh Chickpea Dinner', 'added-nightly');
  const fake = await endpoint(() => {
    github.state.queue = { ...github.state.queue, issueNumber: 77, tasks: [...github.state.queue.tasks, fresh] };
    github.state.learned.titles.it = { 'Already Published Bowl': 'Ciotola già pubblicata' };
    return { language: 'it', text: 'Ciotola di ceci per la sera' };
  });
  const report = await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh });
  expect(report.remaining).toBe(1);
  expect(github.state.queue.tasks).toEqual([fresh]);
  expect(github.state.queue.issueNumber).toBe(77);
  expect(github.state.learned.titles.it).toMatchObject({
    'Already Published Bowl': 'Ciotola già pubblicata', 'Weeknight Chickpea Bowl': 'Ciotola di ceci per la sera'
  });
  expect(fake.requests()).toBe(1);
});

it('refuses unsafe remote entries instead of overwriting a newly accepted safe result', async () => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task()] });
  const fake = await endpoint(() => {
    github.state.learned.titles.it = { 'Weeknight Chickpea Bowl': 'Ciotola al burro', Unused: 'Pollo al forno' };
    return { language: 'it', text: 'Ciotola di ceci per la sera' };
  });
  const report = await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh });
  expect(report.remaining).toBe(0);
  expect(github.state.learned.titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  expect(github.state.learned.titles.it).not.toHaveProperty('Unused');
});

it('leaves local accepted data untouched when GitHub downloads fail and exposes no provider details', async () => {
  const state = files();
  const learned = emptyLearnedData();
  learned.titles.it = { 'Previously Accepted Bowl': 'Ciotola già tradotta' };
  writeJSONAtomic(state.learnedFile, learned);
  const github = remote(emptyQueue());
  github.failures.download = true;
  const fake = await endpoint(() => null);
  let message = '';
  try { await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh }); }
  catch (error) { message = (error as Error).message; }
  expect(message).toContain('Could not download enrichment');
  expect(message).not.toContain('provider-secret');
  expect(readLearnedData(state.learnedFile)).toEqual(learned);
  expect(fake.requests()).toBe(0);
  expect(github.events.some((args) => args[1] === 'upload' || args[0] === 'workflow')).toBe(false);
});

it('reports saved data and a pending deployment when dispatch fails after successful uploads', async () => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task()] });
  github.failures.dispatch = true;
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  const report = await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh });
  expect(report).toMatchObject({ accepted: 1, remaining: 0, deployment: 'pending' });
  expect(github.state.queue.tasks).toEqual([]);
  expect(github.state.learned.titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
});

it('retains local results when the final refresh fails before publication', async () => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task()] });
  const fake = await endpoint(() => {
    github.failures.download = true;
    return { language: 'it', text: 'Ciotola di ceci per la sera' };
  });
  await expect(runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh })).rejects.toThrow('Could not download enrichment');
  expect(readLearnedData(state.learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  expect(github.events.some((args) => args[1] === 'upload' || args[0] === 'workflow')).toBe(false);
});

it('publishes good results from a partially failing model run and keeps unsafe tasks queued', async () => {
  const state = files();
  const github = remote({ ...emptyQueue(), tasks: [task(), task('Plant Pancakes', 'unsafe-title')] });
  const fake = await endpoint(({ original }) => ({ language: 'it', text: original === 'Plant Pancakes' ? 'Pancake al burro' : 'Ciotola di ceci per la sera' }));
  const report = await runRemoteEnrich({ ...state, model: fake.model, repo: 'antomanc/vegdex', gh: github.gh });
  expect(report).toMatchObject({ accepted: 1, remaining: 1, failed: [{ id: 'unsafe-title', reason: 'unsafe-translation' }], deployment: 'triggered' });
  expect(github.state.queue.tasks.map((task) => task.id)).toEqual(['unsafe-title']);
  expect(github.state.learned.titles.it).not.toHaveProperty('Plant Pancakes');
});

it('default CLI runs the remote flow through gh without exposing provider errors', async () => {
  const state = files();
  const dir = path.dirname(state.queueFile);
  const bin = path.join(dir, 'bin');
  const persisted = path.join(dir, 'github');
  fs.mkdirSync(bin);
  fs.mkdirSync(persisted);
  writeJSONAtomic(path.join(persisted, 'enrichment.json'), emptyLearnedData());
  writeJSONAtomic(path.join(persisted, 'translation-queue.json'), { ...emptyQueue(), tasks: [task()] });
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const dir = process.env.ENRICH_TEST_GITHUB;
fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify(args) + '\\n');
if (args[0] === 'api') console.log(JSON.stringify({assets:[{name:'enrichment.json'},{name:'translation-queue.json'}]}));
else if (args[1] === 'download') {
  const name = args[args.indexOf('--pattern') + 1];
  fs.copyFileSync(path.join(dir, name), path.join(args[args.indexOf('--dir') + 1], name));
} else if (args[1] === 'upload') fs.copyFileSync(args[3], path.join(dir, path.basename(args[3])));
else if (args[0] === 'workflow') { console.error('provider-secret: dispatch failed'); process.exitCode = 1; }
else process.exitCode = 1;
`, { mode: 0o755 });
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  let captured: { stdout: string; stderr: string; code?: number } | undefined;
  try {
    await promisify(execFile)('pnpm', ['enrich', '--queue', state.queueFile, '--learned', state.learnedFile], {
      cwd: path.resolve('.'), env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ENRICH_TEST_GITHUB: persisted,
        ENRICH_BASE_URL: fake.model.baseURL, ENRICH_MODEL: fake.model.model }
    });
  } catch (error) { captured = error as typeof captured; }
  expect(captured?.code).toBe(1);
  expect(captured?.stdout).toContain('"deployment":"pending"');
  expect(captured?.stderr).toContain('Enrichment data is saved on GitHub, but deployment is pending');
  expect(`${captured?.stdout}${captured?.stderr}`).not.toContain('provider-secret');
  const calls = fs.readFileSync(path.join(persisted, 'calls.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string[]);
  expect(calls.filter((args) => args[1] === 'upload').map((args) => path.basename(args[3]!))).toEqual(['enrichment.json', 'translation-queue.json']);
  expect(calls.at(-1)).toContain('crawl=false');
});

it('resolves local CLI file arguments from the repository root', async () => {
  fs.mkdirSync(path.resolve('.data'), { recursive: true });
  const dir = fs.mkdtempSync(path.resolve('.data/enrich-relative-'));
  dirs.push(dir);
  const queueFile = path.join(dir, 'translation-queue.json');
  const learnedFile = path.join(dir, 'enrichment.json');
  writeJSONAtomic(queueFile, { ...emptyQueue(), tasks: [task()] });
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  const result = await promisify(execFile)('pnpm', ['enrich', '--local', '--queue', path.relative(path.resolve('.'), queueFile), '--learned', path.relative(path.resolve('.'), learnedFile)], {
    cwd: path.resolve('.'), env: { ...process.env, ENRICH_BASE_URL: fake.model.baseURL, ENRICH_MODEL: fake.model.model }
  });
  expect(result.stdout).toContain('"accepted":1');
  expect(readTranslationQueue(queueFile).tasks).toEqual([]);
  expect(readLearnedData(learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
});
