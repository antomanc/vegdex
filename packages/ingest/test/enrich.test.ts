import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { ingredientNote, parseIngredient, renderIngredient, type FullDataset } from '@vegdex/core';
import { emitDataset } from '../src/emit';
import { englishLookup } from '../src/concepts';
import { loadStore } from '../src/store';
import { runLocalEnrich } from '../src/enrich';
import { emptyLearnedData, emptyQueue, readLearnedData, readTranslationQueue, writeJSONAtomic, type QueueTask } from '../src/enrichment';

const dirs: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); })));
  dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});
function files(tasks: QueueTask[]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-enrich-'));
  dirs.push(dir);
  const queueFile = path.join(dir, 'translation-queue.json');
  const learnedFile = path.join(dir, 'enrichment.json');
  writeJSONAtomic(queueFile, { ...emptyQueue('2026-10-01T00:00:00.000Z'), tasks });
  writeJSONAtomic(learnedFile, emptyLearnedData());
  return { queueFile, learnedFile };
}
function task(kind: QueueTask['kind'], original: string, id = original): QueueTask {
  return { id, kind, original, sourceLanguage: 'en', targetLanguage: 'it', firstSeen: '2026-10-01T00:00:00.000Z', recipes: [{ id: 'recipe-one', title: 'Weeknight Chickpea Bowl' }] };
}
async function endpoint(reply: (request: Record<string, unknown>, index: number) => unknown, options: { status?: number; finishReason?: string; rawBody?: string; content?: string; delayMs?: number } = {}) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body) as Record<string, unknown>;
    requests.push(request);
    res.setHeader('content-type', 'application/json');
    res.statusCode = options.status ?? 200;
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    res.end(options.rawBody ?? JSON.stringify({ choices: [{ finish_reason: options.finishReason ?? 'stop', message: { content: options.content ?? JSON.stringify(reply(request, requests.length - 1)) } }] }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { model: { baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, model: 'fixture-model' }, requests };
}

it('keeps Italian alternatives, compounds and sizes queued when a model drops their wording', async () => {
  const originals = ['ceci o lenticchie', 'ceci e lenticchie', 'ceci piccoli', 'ceci con quinoa'];
  const state = files(originals.map((original) => ({ ...task('ingredient', original), sourceLanguage: 'it', targetLanguage: 'en' })));
  const fake = await endpoint(() => ({ language: 'en', conceptId: englishLookup.chickpeas }));
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, remaining: 4 });
  expect(readLearnedData(state.learnedFile)).toEqual(emptyLearnedData());
});

it('learns an accented Italian name without using English canonicalization', async () => {
  const original = 'farina caffè lunare';
  const state = files([{ ...task('ingredient', original), sourceLanguage: 'it', targetLanguage: 'en' }]);
  const fake = await endpoint(() => ({ language: 'en', conceptId: null, text: 'lunar coffee flour' }));
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 1, remaining: 0 });
  expect(readLearnedData(state.learnedFile).aliases.it).toHaveProperty(original);
});

it('reuses safe English names for all curated Italian plant alternatives without model calls', async () => {
  const state = files(['burro vegetale', 'latte vegetale', 'parmigiano vegano']
    .map((original) => ({ ...task('ingredient', original), sourceLanguage: 'it', targetLanguage: 'en' })));
  const fake = await endpoint(() => null);
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, reused: 3, remaining: 0, failed: [] });
  expect(fake.requests).toHaveLength(0);
});

it('persists a translated title and clears its queue without requesting it again', async () => {
  const state = files([task('title', 'Weeknight Chickpea Bowl')]);
  const fake = await endpoint(() => ({ language: 'it', text: 'Ciotola di ceci per la sera' }));
  const report = await runLocalEnrich({ ...state, model: fake.model });
  expect(report).toMatchObject({ accepted: 1, remaining: 0, failed: [] });
  expect(readLearnedData(state.learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  expect(readTranslationQueue(state.queueFile).tasks).toEqual([]);
  await runLocalEnrich({ ...state, model: fake.model });
  expect(fake.requests).toHaveLength(1);
  expect(fake.requests[0]).toMatchObject({ model: 'fixture-model', stream: false });
});

it('keeps rejected responses queued and retains successes from a partially failing run', async () => {
  const tasks = [task('title', 'Weeknight Chickpea Bowl', 'good'), task('note', 'thoroughly rinsed', 'wrong-language'), task('title', 'Plant Pancakes', 'unsafe')];
  const state = files(tasks);
  const fake = await endpoint((_request, index) => [
    { language: 'it', text: 'Ciotola di ceci per la sera' },
    { language: 'it', text: 'thoroughly rinsed' },
    { language: 'it', text: 'Pancake al burro' }
  ][index]);
  const report = await runLocalEnrich({ ...state, model: fake.model });
  expect(report).toMatchObject({ accepted: 1, remaining: 2, failed: [
    { id: 'wrong-language', reason: 'wrong-language' }, { id: 'unsafe', reason: 'unsafe-translation' }
  ] });
  expect(readLearnedData(state.learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  expect(readTranslationQueue(state.queueFile).tasks.map((t) => t.id)).toEqual(['wrong-language', 'unsafe']);
});


it('learns names and preparation phrases that the next emit renders through curated units', async () => {
  const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
  const recipe = { ...base, title: 'Weeknight Chickpea Bowl', ingredients: ['1 cup mystery flour, finely sifted'] };
  const source = { id: base.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' };
  const state = files([]);
  const out = path.join(path.dirname(state.queueFile), 'public');
  const initial = emitDataset([recipe], [source], out);
  writeJSONAtomic(state.queueFile, initial.queue);
  const fake = await endpoint((request) => {
    const messages = request.messages as { content: string }[];
    const input = JSON.parse(messages[1]!.content);
    return input.kind === 'title' ? { language: 'it', text: 'Ciotola di ceci per la sera' }
      : input.kind === 'note' ? { language: 'it', text: 'setacciata finemente' }
      : { language: 'it', conceptId: null, text: 'farina misteriosa', vegan: 'yes' };
  });
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 3, remaining: 0 });
  const learned = readLearnedData(state.learnedFile);
  expect(learned.concepts[0]?.vegan).toBe('unknown');
  const emitted = emitDataset([recipe], [source], out, { learnedData: learned });
  expect(emitted.queue.tasks).toEqual([]);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/it.json'), 'utf8'));
  expect(renderIngredient(full.recipes[0]!.parsedIngredients![0]!, overlay.ingredients, 'it', 'us')).toEqual(['1 tazza', 'farina misteriosa, setacciata finemente']);
});

it('rechecks held Italian recipes after guarded English enrichment and clears only released holds', async () => {
  const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
  const recipe = { ...base, title: 'Frittelle lunari', ingredients: ['200 g farina lunare, setacciata finemente'] };
  const source = { id: base.sourceId, name: 'Italian Vegan', url: 'https://noracooks.com', contentLanguage: 'it' };
  const state = files([]);
  const out = path.join(path.dirname(state.queueFile), 'public');
  const initial = emitDataset([recipe], [source], out, { generatedAt: '2026-10-01T00:00:00.000Z' });
  writeJSONAtomic(state.queueFile, initial.queue);
  let safe = false;
  const fake = await endpoint((request) => {
    const input = JSON.parse((request.messages as { content: string }[])[1]!.content);
    expect(input.sourceLanguage).toBe('it');
    expect(input.targetLanguage).toBe('en');
    return input.kind === 'title' ? { language: 'en', text: 'Lunar pancakes' }
      : input.kind === 'note' ? { language: 'en', text: 'finely sifted' }
      : { language: 'en', conceptId: null, text: safe ? 'lunar flour' : 'butter' };
  });
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 2, remaining: 1, failed: [expect.objectContaining({ reason: 'unsafe-translation' })] });
  const rejected = emitDataset([recipe], [source], out, { learnedData: readLearnedData(state.learnedFile), previousQueue: readTranslationQueue(state.queueFile), generatedAt: '2026-10-29T00:00:00.000Z' });
  expect(rejected.published).toBe(0);
  expect(rejected.queue.held).toEqual(initial.queue.held);
  safe = true;
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 1, remaining: 0, failed: [] });
  const learned = readLearnedData(state.learnedFile);
  const released = emitDataset([recipe], [source], out, { learnedData: learned, previousQueue: rejected.queue });
  expect(released.published).toBe(1);
  expect(released.queue.held).toEqual([]);
  expect(released.queue.tasks).toEqual([]);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/en.json'), 'utf8'));
  expect(full.recipes[0]).toMatchObject({ title: 'Frittelle lunari', contentLanguage: 'it', ingredients: recipe.ingredients });
  expect(overlay.titles['Frittelle lunari']).toBe('Lunar pancakes');
  expect(renderIngredient(full.recipes[0]!.parsedIngredients![0]!, overlay.ingredients, 'en', 'metric')).toEqual(['200 g', 'lunar flour, finely sifted']);
  const blocked = emitDataset([recipe], [source], out, { learnedData: learned, previousQueue: initial.queue, blocklist: [recipe.id] });
  expect(blocked.published).toBe(0);
  expect(blocked.queue.held).toEqual([]);
  expect(blocked.excluded[0]?.reason).toBe('blocklist');
});

it('accepts negative animal-concept evidence while keeping a qualified mismatch queued', async () => {
  const state = files([task('ingredient', 'bee nectar', 'animal'), task('ingredient', 'vegan nectar', 'plant')]);
  const fake = await endpoint(() => ({ language: 'it', conceptId: englishLookup.honey }));
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 1, remaining: 1, failed: [{ id: 'plant', reason: 'qualification-lost' }] });
  const learned = readLearnedData(state.learnedFile);
  expect(learned.aliases.en?.['bee nectar']).toBe(englishLookup.honey);
  expect(learned.aliases.en).not.toHaveProperty('vegan nectar');
  const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
  const source = { id: base.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' };
  const recipe = { ...base, ingredients: ['1 tbsp bee nectar'] };
  const out = path.join(path.dirname(state.queueFile), 'public');
  expect(emitDataset([recipe], [source], out).published).toBe(1);
  const report = emitDataset([recipe], [source], out, { learnedData: learned });
  expect(report.published).toBe(0);
  expect(report.excluded[0]?.hits[0]?.concept).toBe(englishLookup.honey);
});

it('recovers a stale queue after learned data was saved and honors committed translations', async () => {
  const entry = task('title', 'Weeknight Chickpea Bowl');
  const state = files([entry, task('title', 'Fluffy Vegan Pancakes')]);
  const learned = emptyLearnedData();
  learned.titles.it = { [entry.original]: 'Ciotola di ceci per la sera', 'Fluffy Vegan Pancakes': 'Testo da ignorare' };
  writeJSONAtomic(state.learnedFile, learned);
  const fake = await endpoint(() => null);
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, reused: 2, remaining: 0 });
  expect(fake.requests).toHaveLength(0);
});

it('refuses aliases that would erase sizes or alternatives', async () => {
  const state = files([task('ingredient', 'large carrots', 'size'), task('ingredient', 'walnuts or almonds', 'alternative')]);
  const fake = await endpoint((_request, index) => ({ language: 'it', conceptId: index ? englishLookup.walnuts : englishLookup.carrots, text: index ? 'noci' : 'carote' }));
  const report = await runLocalEnrich({ ...state, model: fake.model });
  expect(report.accepted).toBe(0);
  expect(report.remaining).toBe(2);
  expect(readLearnedData(state.learnedFile)).toEqual(emptyLearnedData());
});


it('keeps malformed, truncated, wrong-metadata and unknown-concept results retryable', async () => {
  for (const [reply, options, reason] of [
    [() => ({ language: 'en', text: 'Wrong language' }), {}, 'wrong-language'],
    [() => ({ language: 'it', conceptId: 'invented:id', text: 'farina' }), {}, 'unknown-concept'],
    [() => ({}), { content: 'not JSON' }, 'malformed-response'],
    [() => ({ language: 'it', text: 'Farina' }), { finishReason: 'length' }, 'incomplete-response'],
    [() => null, { status: 503 }, 'http-error'],
    [() => ({ language: 'it', text: 'Farina' }), { delayMs: 100 }, 'request-failed']
  ] as const) {
    const state = files([task('ingredient', 'mystery flour', 'retry')]);
    const fake = await endpoint(reply, options);
    const report = await runLocalEnrich({ ...state, model: { ...fake.model, ...('delayMs' in options ? { timeoutMs: 10 } : {}) } });
    expect(report.failed).toEqual([{ id: 'retry', reason }]);
    expect(readTranslationQueue(state.queueFile).tasks).toHaveLength(1);
    expect(readLearnedData(state.learnedFile)).toEqual(emptyLearnedData());
  }
});

it('never persists a model response containing the configured API key', async () => {
  const state = files([task('title', 'Weeknight Chickpea Bowl', 'secret-response')]);
  const secret = 'fixture-secret-not-real';
  const fake = await endpoint(() => ({ language: 'it', text: `Ciotola ${secret}` }));
  const report = await runLocalEnrich({ ...state, model: { ...fake.model, apiKey: secret } });
  expect(report.failed).toEqual([{ id: 'secret-response', reason: 'secret-in-response' }]);
  expect(JSON.stringify(report)).not.toContain(secret);
  expect(fs.readFileSync(state.learnedFile, 'utf8')).not.toContain(secret);
});


it('local CLI uses environment configuration and emits only safe failure details', async () => {
  const state = files([task('title', 'Weeknight Chickpea Bowl', 'cli-task')]);
  const secret = 'fixture-cli-secret-not-real';
  const fake = await endpoint(() => ({ language: 'it', text: secret }));
  let captured: { stdout: string; stderr: string; code?: number } | undefined;
  try {
    await promisify(execFile)('pnpm', ['enrich', '--local', '--queue', state.queueFile, '--learned', state.learnedFile], {
      cwd: path.resolve('.'), env: { ...process.env, ENRICH_BASE_URL: fake.model.baseURL, ENRICH_MODEL: fake.model.model, ENRICH_API_KEY: secret }
    });
  } catch (error) { captured = error as typeof captured; }
  expect(captured?.code).toBe(1);
  expect(captured?.stdout).toContain('secret-in-response');
  expect(`${captured?.stdout}${captured?.stderr}`).not.toContain(secret);
  expect(readTranslationQueue(state.queueFile).tasks).toHaveLength(1);
});

it('resumes without another request when retiring the queue fails after saving a result', async () => {
  const state = files([task('title', 'Weeknight Chickpea Bowl')]);
  const parent = path.dirname(state.queueFile);
  const queueDir = path.join(parent, 'pending');
  const queueFile = path.join(queueDir, 'translation-queue.json');
  const backup = path.join(parent, 'queue-backup.json');
  fs.mkdirSync(queueDir);
  fs.renameSync(state.queueFile, queueFile);
  const fake = await endpoint(() => {
    fs.renameSync(queueFile, backup);
    fs.rmdirSync(queueDir);
    fs.writeFileSync(queueDir, 'simulate an unavailable queue directory');
    return { language: 'it', text: 'Ciotola di ceci per la sera' };
  });
  await expect(runLocalEnrich({ ...state, queueFile, model: fake.model })).rejects.toThrow();
  expect(readLearnedData(state.learnedFile).titles.it?.['Weeknight Chickpea Bowl']).toBe('Ciotola di ceci per la sera');
  fs.rmSync(queueDir);
  fs.mkdirSync(queueDir);
  fs.renameSync(backup, queueFile);
  expect(await runLocalEnrich({ ...state, queueFile, model: fake.model })).toMatchObject({ accepted: 0, reused: 1, remaining: 0 });
  expect(fake.requests).toHaveLength(1);
});

it('does not print a malformed secret-bearing endpoint in CLI configuration errors', async () => {
  const secret = 'fixture-invalid-secret-not-real';
  let captured: { stdout: string; stderr: string; code?: number } | undefined;
  try {
    await promisify(execFile)('pnpm', ['enrich', '--local'], {
      cwd: path.resolve('.'), env: { ...process.env, ENRICH_BASE_URL: `invalid-${secret}`, ENRICH_MODEL: 'fixture-model' }
    });
  } catch (error) { captured = error as typeof captured; }
  expect(captured?.code).toBe(1);
  expect(captured?.stderr).toContain('Enrich failed.');
  expect(`${captured?.stdout}${captured?.stderr}`).not.toContain(secret);
});

it('does not let model translations change quantities inside preparation notes', async () => {
  const state = files([task('note', '15 ounces, drained', 'changed-quantity')]);
  const fake = await endpoint(() => ({ language: 'it', text: '200 g, scolati' }));
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, remaining: 1, failed: [{ id: 'changed-quantity', reason: 'quantity-changed' }] });
});

it('rejects a translated full ingredient line offered in place of an ingredient name', async () => {
  const state = files([task('ingredient', 'mystery beans', 'introduced-amount')]);
  const fake = await endpoint(() => ({ language: 'it', conceptId: null, text: '400 g fagioli' }));
  expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, remaining: 1, failed: [{ id: 'introduced-amount', reason: 'quantity-changed' }] });
  expect(readLearnedData(state.learnedFile)).toEqual(emptyLearnedData());
});

it('rejects changed can-size units and accepts only the curated localized equivalent', async () => {
  for (const [translation, accepted] of [['15 kg, scolati', false], ['15 once, scolati', true]] as const) {
    const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
    const recipe = { ...base, ingredients: ['1 (15 ounce) can chickpeas, drained'] };
    const source = { id: base.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' };
    const state = files([]);
    const out = path.join(path.dirname(state.queueFile), 'public');
    const initial = emitDataset([recipe], [source], out);
    const entry = initial.queue.tasks.find((task) => task.kind === 'note')!;
    writeJSONAtomic(state.queueFile, { ...initial.queue, tasks: [entry] });
    const fake = await endpoint(() => ({ language: 'it', text: translation }));
    const report = await runLocalEnrich({ ...state, model: fake.model });
    expect(report.accepted).toBe(accepted ? 1 : 0);
    expect(report.remaining).toBe(accepted ? 0 : 1);
    if (!accepted) expect(report.failed).toEqual([{ id: entry.id, reason: 'unit-changed' }]);
    emitDataset([recipe], [source], out, { learnedData: readLearnedData(state.learnedFile) });
    const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
    const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/it.json'), 'utf8'));
    expect(overlay.ingredients.units.oz).toEqual(['oncia', 'once']);
    const rendered = renderIngredient(full.recipes[0]!.parsedIngredients![0]!, overlay.ingredients, 'it', 'us');
    expect(rendered).toEqual(accepted ? ['1 lattina', 'ceci, 15 once, scolati'] : null);
  }
});

it('refuses model titles naming unqualified newly covered cheeses', async () => {
  for (const cheese of ['cheddar', 'gorgonzola']) {
    const state = files([task('title', 'Weeknight Chickpea Bowl')]);
    const fake = await endpoint(() => ({ language: 'it', text: `Pasta al ${cheese}` }));
    expect(await runLocalEnrich({ ...state, model: fake.model })).toMatchObject({ accepted: 0, remaining: 1, failed: [{ reason: 'unsafe-translation' }] });
  }
});

it('requeues cached notes with changed units and excludes them from emitted overlays', () => {
  const base = loadStore(path.resolve('e2e/fixtures/store.json')).recipes.pancakes!;
  const recipe = { ...base, ingredients: ['1 (15 ounce) can chickpeas, drained'] };
  const state = files([]);
  const out = path.join(path.dirname(state.queueFile), 'public');
  const learned = emptyLearnedData();
  const originalNote = ingredientNote(parseIngredient(recipe.ingredients[0]!, englishLookup));
  learned.ingredientTables.it = { names: {}, notes: { [originalNote]: '15 kg, scolati' }, units: {} };
  const result = emitDataset([recipe], [{ id: base.sourceId, name: 'Nora Cooks', url: 'https://noracooks.com' }], out, { learnedData: learned });
  expect(result.queue.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'note', original: originalNote })]));
  const overlay = JSON.parse(fs.readFileSync(path.join(out, 'overlay/it.json'), 'utf8'));
  expect(overlay.ingredients.notes).not.toHaveProperty(originalNote);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'recipes.full.json'), 'utf8')) as FullDataset;
  expect(full.recipes[0]!.ingredients).toEqual(recipe.ingredients);
  expect(renderIngredient(full.recipes[0]!.parsedIngredients![0]!, overlay.ingredients, 'it', 'us')).toBeNull();
});
