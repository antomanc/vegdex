import { it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lineKey } from '@vegdex/core';
import { consistentNames, convertAudit, loadLineRecords, lookupLineRecord, writeLineRecords } from '../src/line-records';

it('keeps qualifiers and applies overrides and weighted majority to alternatives', () => {
  const a = convertAudit({ lang: 'en', line: 'fresh ginger', n: 3 }, { i: 0, p: [{ en: 'fresh ginger', it: 'zenzero fresco', alt: [{en:'flour',it:'farina sbagliata'}] }] });
  const b = convertAudit({ lang: 'en', line: 'ginger', n: 1 }, { i: 1, p: [{ en: 'fresh ginger', it: 'zenzero' }] });
  consistentNames([{record:a,uses:3},{record:b,uses:1}], {flour:'farina 00'});
  expect(b.parts?.[0]?.it).toBe('zenzero fresco');
  expect(a.parts?.[0]?.alternatives?.[0]?.it).toBe('farina 00');
  expect(a.parts?.[0]?.en).toBe('fresh ginger');
});

it('writes records into sorted shards and loads them back with exact text matching', async () => {
  const dir = await mkdtemp(join(tmpdir(),'line-store-'));
  try {
    const salt = convertAudit({ lang: 'en', line: '1 salt', n: 1 }, { i: 0, p: [{ q: 1, en: 'salt', it: 'sale' }] });
    const pepper = convertAudit({ lang: 'en', line: '1 pepper', n: 1 }, { i: 1, p: [{ q: 1, en: 'pepper', it: 'pepe' }] });
    writeLineRecords(dir, new Map([[lineKey(salt.language, salt.line), salt], [lineKey(pepper.language, pepper.line), pepper]]), 'test-model');
    const loaded = loadLineRecords(dir);
    expect(lookupLineRecord(loaded, 'en', '1 salt')?.parts?.[0]?.it).toBe('sale');
    expect(lookupLineRecord(loaded, 'en', ' 1 salt')).toBeUndefined();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
