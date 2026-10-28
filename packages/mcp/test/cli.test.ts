import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';

it('CLI searches the emitted English dataset with synonyms and returns original lines', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const run = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: path.join(root, 'packages/mcp'), encoding: 'utf8',
    env: { ...process.env, VEGDEX_DATA_FILE: path.join(root, 'e2e/fixtures/data/recipes.full.json') }
  });
  const result = JSON.parse(run('search', 'garbanzo', '--json'));
  expect(result.total).toBe(1);
  expect(result.recipes[0]).toMatchObject({ id: 'quinoa-salad', title: 'Lemony Quinoa Salad', contentLanguage: 'en' });
  expect(run('show', 'quinoa-salad')).toContain('400 g chickpeas, drained and rinsed');
});
