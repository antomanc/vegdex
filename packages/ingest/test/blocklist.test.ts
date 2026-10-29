import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Catalog, FullDataset } from '@vegdex/core';
import { afterEach, expect, it } from 'vitest';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

it('removes a reported recipe from every public dataset while retaining the other publication checks', () => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-blocklist-'));
  dirs.push(out);
  const report = emitDataset(Object.values(store.recipes), sources, out, { blocklist: ['lentil-soup'] });
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
  const catalog = read('catalog.json') as Catalog;
  const full = read('recipes.full.json') as FullDataset;

  expect(catalog.recipes.some((r) => r.id === 'lentil-soup')).toBe(false);
  expect(full.recipes.some((r) => r.id === 'lentil-soup')).toBe(false);
  for (const file of fs.readdirSync(path.join(out, 'details')))
    expect(read(`details/${file}`)).not.toHaveProperty('lentil-soup');
  expect(catalog.recipes.some((r) => r.id === 'pancakes')).toBe(true);
  expect(catalog.recipes.some((r) => r.id === 'honey-carrots')).toBe(false);
  expect(report.excluded).toContainEqual(expect.objectContaining({
    id: 'lentil-soup', reason: 'blocklist', url: 'https://example.com/lentil-soup/'
  }));
});
