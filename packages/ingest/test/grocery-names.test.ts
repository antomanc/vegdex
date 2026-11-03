import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { emitDataset } from '../src/emit';
import { loadStore } from '../src/store';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const emit = (groceryNames: Record<string, string>) => {
  const store = loadStore(path.resolve('e2e/fixtures/store.json'));
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-grocery-names-'));
  dirs.push(out);
  emitDataset(Object.values(store.recipes), sources, out, { groceryNames });
  return JSON.parse(fs.readFileSync(path.join(out, 'lookup/en.json'), 'utf8')).grocery;
};

it('names a shopping-list row from the committed table, keeping its aisle', () => {
  const grocery = emit({ 'off:288971671685b8da': 'yellow onion' });
  expect(grocery['off:288971671685b8da']).toEqual(['yellow onion', 'produce']);
});

it('rejects a table entry for a concept the vocabulary does not know', () => {
  expect(() => emit({ 'off:does-not-exist': 'nothing' })).toThrow(/off:does-not-exist/);
});
