import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';

const run = promisify(execFile);
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

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
