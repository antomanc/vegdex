import { it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consistentNames, convertAudit, importLines } from '../src/lines-import';
import { loadLineRecords, lookupLineRecord } from '../src/line-records';

it('keeps qualifiers and applies overrides and weighted majority to alternatives', () => {
  const a = convertAudit({ lang: 'en', line: 'fresh ginger', n: 3 }, { i: 0, p: [{ en: 'fresh ginger', it: 'zenzero fresco', alt: [{en:'flour',it:'farina sbagliata'}] }] });
  const b = convertAudit({ lang: 'en', line: 'ginger', n: 1 }, { i: 1, p: [{ en: 'fresh ginger', it: 'zenzero' }] });
  consistentNames([{record:a,uses:3},{record:b,uses:1}], {flour:'farina 00'});
  expect(b.parts?.[0]?.it).toBe('zenzero fresco');
  expect(a.parts?.[0]?.alternatives?.[0]?.it).toBe('farina 00');
  expect(a.parts?.[0]?.en).toBe('fresh ginger');
});

it('imports deterministically, rejects errors and loads with exact text matching', async () => {
  const dir = await mkdtemp(join(tmpdir(),'line-store-'));
  try {
    await mkdir(join(dir,'batches'));
    await writeFile(join(dir,'lines.json'), JSON.stringify([{lang:'en',line:'1 salt',n:1},{lang:'en',line:'bad',n:1}]));
    await writeFile(join(dir,'batches/0.out'), '{"i":0,"p":[{"q":1,"en":"salt","it":"sale"}]}\n{"i":1,"p":[{"q":-1,"en":"salt","it":"sale"}]}\n');
    const store = join(dir,'store');
    const report = await importLines(dir,store,join(dir,'reread.json'));
    expect(report.rejected).toBe(1);
    const first = await loadLineRecords(store);
    expect(lookupLineRecord(first,'en','1 salt')?.parts?.[0]?.it).toBe('sale');
    expect(lookupLineRecord(first,'en',' 1 salt')).toBeUndefined();
    expect(await importLines(dir,store,join(dir,'reread.json'))).toEqual(report);
    expect(await loadLineRecords(store)).toEqual(first);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
