import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';

const run = promisify(execFile);
const dirs: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); })));
  dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

it('evaluates catalog cases with project-relative report paths without modifying learned data', async () => {
  const answers: Record<string, object> = {
    'Chana Masala (Quick + Easy)': { text: 'Chana masala (facile e veloce)' },
    'Vegan Pumpkin Mac and Cheese (One Skillet)': { text: 'Pasta con zucca e formaggio vegano in una padella' },
    'Green Chile White Bean Skillet with Crispy Panko Topping': { text: 'Fagioli bianchi in padella con peperoncino verde e panko croccante' },
    '5 Minute Stir Fry Sauce': { text: 'Salsa per saltare in padella in 5 minuti' },
    '5 minute Tofu "Egg" Salad Sandwich': { text: 'Panino con insalata di uovo vegano di tofu in 5 minuti' },
    'minced': { text: 'tritato' }, 'grated or minced': { text: 'grattugiato o tritato' },
    'melted': { text: 'fuso' }, 'softened': { text: 'ammorbidito' },
    'drained and rinsed': { text: 'scolati e sciacquati' },
    'vegan butter': { conceptId: 'veg:0001', text: 'burro vegano' },
    'garlic': { conceptId: 'off:41024084d2e27b7d', text: 'aglio' },
    'cannellini beans': { conceptId: 'off:76299b83f7ce63ae', text: 'fagioli cannellini' },
    'panko': { conceptId: 'off:2c9bf62209dfea1e', text: 'pangrattato panko' }
  };
  const root = path.resolve('.');
  fs.mkdirSync(path.join(root, '.data'), { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, '.data', 'vegdex-eval-'));
  dirs.push(dir);
  const learnedFile = path.join(dir, 'enrichment.json');
  fs.writeFileSync(learnedFile, 'leave learned entries untouched');
  const server = createServer(async (req, res) => {
    expect(req.url).toBe('/v1/chat/completions');
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    const input = JSON.parse(request.messages[1].content);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ language: 'it', ...answers[input.original] }) } }] }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const result = await run('pnpm', ['--filter', '@vegdex/ingest', 'exec', 'tsx', 'src/evaluate-cli.ts', '--label', 'fake-good', '--identity', 'fixture/revision:q4', '--server-version', 'fake/1', '--report-dir', path.relative(root, dir)], {
    cwd: root,
    env: { ...process.env, ENRICH_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, ENRICH_MODEL: 'fake-model', ENRICH_API_KEY: '' }
  }).catch((error) => { throw new Error(error.stdout + error.stderr + fs.readFileSync(path.join(dir, "fake-good.eval.json"), "utf8")); });
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'fake-good.eval.json'), 'utf8'));
  expect(report).toMatchObject({ evaluationVersion: 1, model: 'fake-model', identity: 'fixture/revision:q4', serverVersion: 'fake/1', scores: {
    meaningHeuristic: { passed: 14, total: 14 }, responseValidity: { passed: 14, total: 14 }, qualifierPreservation: { passed: 2, total: 2 }, safetyFailures: 0
  } });
  expect(report.cases).toHaveLength(14);
  expect(report.cases[0].proposal).toEqual({ kind: 'title', text: 'Chana masala (facile e veloce)' });
  expect(result.stdout).toContain('14/14');
  expect(fs.readFileSync(learnedFile, 'utf8')).toBe('leave learned entries untouched');
});

it('scores lost qualifiers, wrong mappings, changed numbers and malformed or secret-bearing responses as failures', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-eval-'));
  dirs.push(dir);
  const secret = 'private-test-token-DO-NOT-SAVE';
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/evaluation-adversarial.json', import.meta.url), 'utf8'));
  const server = createServer(async (req, res) => {
    expect(req.headers.authorization).toBe(`Bearer ${secret}`);
    let body = '';
    for await (const chunk of req) body += chunk;
    const original = JSON.parse(JSON.parse(body).messages[1].content).original;
    const answer = fixture.responses[original] ?? null;
    const content = (typeof answer === 'string' ? answer : JSON.stringify(answer)).replace('SECRET_PLACEHOLDER', secret);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const result = await run('pnpm', ['eval:enrichment', '--label', 'fake-bad', '--identity', 'adversarial-fixture', '--server-version', 'fake/1', '--report-dir', dir], {
    env: { ...process.env, ENRICH_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, ENRICH_MODEL: 'fake-model', ENRICH_API_KEY: secret }
  }).then(() => { throw new Error('Expected the evaluation to fail'); }, (error) => error);
  expect(result.code).toBe(1);
  const serialized = fs.readFileSync(path.join(dir, 'fake-bad.eval.json'), 'utf8');
  const report = JSON.parse(serialized);
  expect(report.scores).toEqual({ meaningHeuristic: { passed: 0, total: 14 }, responseValidity: { passed: 1, total: 14 }, qualifierPreservation: { passed: 0, total: 2 }, safetyFailures: 1 });
  expect(report.cases).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'ingredient-butter', accepted: false, reason: 'unsafe-translation', qualifierPreserved: false }),
    expect.objectContaining({ id: 'ingredient-garlic', accepted: true, meaningHeuristic: false }),
    expect.objectContaining({ id: 'title-chana', accepted: false, reason: 'malformed-response' }),
    expect.objectContaining({ id: 'title-5-minutes', accepted: false, reason: 'quantity-changed' }),
    expect.objectContaining({ id: 'title-panko', accepted: false, reason: 'secret-in-response' })
  ]));
  expect(serialized + result.stdout + result.stderr).not.toContain(secret);
  expect(serialized).not.toContain('rejected payload');
});

it('offers wizard help and prerequisite inspection without changing files or opening setup', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-wizard-'));
  dirs.push(dir);
  const script = path.resolve('scripts/setup-enrichment.sh');
  await run('bash', ['-n', script]);
  const help = await run('bash', [script, '--help'], { cwd: dir, env: { ...process.env, ENV_FILE: path.join(dir, 'private.env') } });
  expect(help.stdout).toContain('--check');
  const check = await run('bash', [script, '--check'], { cwd: dir, env: { ...process.env, ENV_FILE: path.join(dir, 'private.env') } }).catch((error) => error);
  expect(check.stdout).toContain('llama-server');
  expect(fs.readdirSync(dir)).toEqual([]);
});
