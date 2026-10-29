import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

const { values } = parseArgs({ options: { ui: { type: 'boolean' }, help: { type: 'boolean' } } });
if (values.help) {
  console.log('pnpm preflight [--ui]\nChecks Node, dependencies, pnpm, gh and optional Trail navigation. --ui also checks agent-browser (AGENT_BROWSER_BIN overrides its path) and launches/closes Chromium. Installs nothing.');
  process.exit(0);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let failed = false;
const minimum = manifest.engines.node.replace(/^>=/, '');
if (process.versions.node.localeCompare(minimum, 'en', { numeric: true }) < 0) failed = true;
console.log(`Node: ${process.version} (requires ${manifest.engines.node})`);
if (fs.existsSync(path.join(root, 'node_modules/.bin/tsc'))) console.log('Dependencies: installed');
else {
  console.log('Dependencies: missing; run pnpm install --frozen-lockfile');
  failed = true;
}

function command(name, executable, required = true) {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 5000 });
  const ready = result.status === 0;
  console.log(`${name}: ${ready ? result.stdout.trim().split('\n')[0] : 'missing or not runnable'}`);
  if (!ready && required) failed = true;
  return ready;
}

command('pnpm', 'pnpm');
command('gh', 'gh');
if (!command('trail', 'trail', false)) {
  console.log(fs.existsSync(path.join(root, '.trail/cache/INDEX.md'))
    ? 'Navigation: use .trail/cache/INDEX.md and rg --files --hidden .trail/cache; verify cached spans against source.'
    : 'Navigation: no cached graph; use rg --files and scoped source searches.');
}

if (values.ui) {
  command('agent-browser', process.env.AGENT_BROWSER_BIN || 'agent-browser');
  try {
    const { chromium } = await import('@playwright/test');
    const executable = chromium.executablePath();
    if (!fs.existsSync(executable)) {
      console.log('Chromium: missing; run pnpm exec playwright install --with-deps chromium');
      failed = true;
    } else {
      const browser = await chromium.launch({ headless: true, timeout: 10000 });
      await browser.close();
      console.log(`Chromium: launch passed; agent-browser --executable-path ${executable}`);
    }
  } catch {
    console.log('Chromium: launch failed; check Playwright installation and browser system dependencies');
    failed = true;
  }
}

console.log(failed ? 'Preflight failed.' : 'Preflight passed.');
process.exitCode = failed ? 1 : 0;
