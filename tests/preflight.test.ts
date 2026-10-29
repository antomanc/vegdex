import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';

const run = promisify(execFile);
const sourceScript = path.resolve('scripts/preflight.mjs');
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
function environment(tools: string[], cached = false) {
  fs.mkdirSync('.data', { recursive: true });
  const dir = fs.mkdtempSync(path.resolve('.data/preflight-'));
  dirs.push(dir);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  for (const tool of tools) fs.writeFileSync(path.join(bin, tool), '#!/bin/sh\n[ "$1" = "--version" ] || exit 9\nprintf "fixture-version\\n"\n', { mode: 0o755 });
  fs.mkdirSync(path.join(dir, 'scripts'));
  const script = path.join(dir, 'scripts/preflight.mjs');
  fs.copyFileSync(sourceScript, script);
  fs.copyFileSync('package.json', path.join(dir, 'package.json'));
  fs.mkdirSync(path.join(dir, 'node_modules/.bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules/.bin/tsc'), '');
  if (cached) {
    fs.mkdirSync(path.join(dir, '.trail/cache'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.trail/cache/INDEX.md'), 'Fixture cache');
  }
  return { script, cwd: dir, env: { ...process.env, PATH: bin, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, 'no-browsers'), AGENT_BROWSER_BIN: path.join(bin, 'agent-browser') } };
}

it.each([true, false])('checks required tools from any directory with cached navigation: %s', async (cached) => {
  const { script, ...options } = environment(['pnpm', 'gh'], cached);
  const before = fs.readdirSync(options.cwd);
  const result = await run(process.execPath, [script], { ...options, cwd: path.join(options.cwd, 'bin') });
  expect(result.stdout).toContain('pnpm: fixture-version');
  expect(result.stdout).toContain('gh: fixture-version');
  expect(result.stdout).toContain(cached ? 'Navigation: use .trail/cache/' : 'Navigation: no cached graph; use rg --files');
  expect(result.stdout).not.toContain('graft/');
  expect(fs.readdirSync(options.cwd)).toEqual(before);
});

it('fails when a required tool cannot run without installing anything', async () => {
  const { script, ...options } = environment([]);
  const before = fs.readdirSync(options.cwd);
  const result = await run(process.execPath, [script], options).catch((error) => error);
  expect(result.code).toBe(1);
  expect(result.stdout).toContain('pnpm: missing or not runnable');
  expect(result.stdout).toContain('gh: missing or not runnable');
  expect(fs.readdirSync(options.cwd)).toEqual(before);
});

it('checks UI tools only when requested and respects a configured browser CLI path', async () => {
  const { script, ...options } = environment(['pnpm', 'gh']);
  const before = fs.readdirSync(options.cwd);
  const missing = await run(process.execPath, [script, '--ui'], options).catch((error) => error);
  expect(missing.code).toBe(1);
  expect(missing.stdout).toContain('agent-browser: missing or not runnable');
  expect(missing.stdout).toContain('Chromium: missing');
  fs.writeFileSync(options.env.AGENT_BROWSER_BIN, '#!/bin/sh\nprintf "browser-fixture\\n"\n', { mode: 0o755 });
  const configured = await run(process.execPath, [script, '--ui'], options).catch((error) => error);
  expect(configured.stdout).toContain('agent-browser: browser-fixture');
  expect(configured.stdout).toContain('Chromium: missing');
  expect(fs.readdirSync(options.cwd)).toEqual(before);
});
