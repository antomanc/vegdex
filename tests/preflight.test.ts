import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';

const run = promisify(execFile);
const script = path.resolve('scripts/preflight.mjs');
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
function environment(tools: string[]) {
  fs.mkdirSync('.data', { recursive: true });
  const dir = fs.mkdtempSync(path.resolve('.data/preflight-'));
  dirs.push(dir);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  for (const tool of tools) fs.writeFileSync(path.join(bin, tool), '#!/bin/sh\nprintf "fixture-version\\n"\n', { mode: 0o755 });
  return { cwd: dir, env: { ...process.env, PATH: bin, PLAYWRIGHT_BROWSERS_PATH: path.join(dir, 'no-browsers'), AGENT_BROWSER_BIN: path.join(bin, 'agent-browser') } };
}

it('checks required tools from any directory and reports the actual cache fallback', async () => {
  const options = environment(['pnpm', 'gh']);
  const result = await run(process.execPath, [script], options);
  expect(result.stdout).toContain('pnpm: fixture-version');
  expect(result.stdout).toContain('gh: fixture-version');
  expect(result.stdout).toContain('.trail/cache/');
  expect(result.stdout).not.toContain('graft/');
  expect(fs.readdirSync(options.cwd)).toEqual(['bin']);
});

it('fails when a required tool cannot run without installing anything', async () => {
  const options = environment([]);
  const result = await run(process.execPath, [script], options).catch((error) => error);
  expect(result.code).toBe(1);
  expect(result.stdout).toContain('pnpm: missing or not runnable');
  expect(result.stdout).toContain('gh: missing or not runnable');
  expect(fs.readdirSync(options.cwd)).toEqual(['bin']);
});

it('checks UI tools only when requested and respects a configured browser CLI path', async () => {
  const options = environment(['pnpm', 'gh']);
  const missing = await run(process.execPath, [script, '--ui'], options).catch((error) => error);
  expect(missing.code).toBe(1);
  expect(missing.stdout).toContain('agent-browser: missing or not runnable');
  expect(missing.stdout).toContain('Chromium: missing');
  fs.writeFileSync(options.env.AGENT_BROWSER_BIN, '#!/bin/sh\nprintf "browser-fixture\\n"\n', { mode: 0o755 });
  const configured = await run(process.execPath, [script, '--ui'], options).catch((error) => error);
  expect(configured.stdout).toContain('agent-browser: browser-fixture');
  expect(configured.stdout).toContain('Chromium: missing');
  expect(fs.readdirSync(options.cwd)).toEqual(['bin']);
});
