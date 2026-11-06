import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { lineKey, validateRecord, type LineRecord, type LinePart, type LineAlternative, type LineAmount } from '@vegdex/core';
import { lineShard, lineStoreDirectory } from './line-records';

interface AuditAmount { q?: number; m?: number; u?: string }
interface AuditPart extends AuditAmount {
  en: string; it: string; plus?: AuditAmount; pe?: string; pi?: string; s?: string; si?: string; o?: number; t?: number;
  alt?: (AuditAmount & { en: string; it: string })[];
}
interface AuditRow { i: number; k?: 'h' | 'o'; p?: AuditPart[] }
interface AuditLine { lang: string; line: string; n: number }
const amount = (a: AuditAmount): LineAmount => ({
  ...(a.q !== undefined ? { quantity: a.q } : {}), ...(a.m !== undefined ? { quantityMax: a.m } : {}), ...(a.u !== undefined ? { unit: a.u } : {})
});
export function convertAudit(line: AuditLine, row: AuditRow): LineRecord {
  if (row.k) return { line: line.line, language: line.lang, kind: row.k === 'h' ? 'heading' : 'other' };
  return { line: line.line, language: line.lang, parts: row.p?.map((p): LinePart => ({
    ...amount(p), en: p.en, it: p.it,
    ...(p.plus ? { plus: amount(p.plus) } : {}),
    ...(p.pe ? { preparationEn: p.pe } : {}), ...(p.pi ? { preparationIt: p.pi } : {}),
    ...(p.s ? { purposeEn: p.s } : {}), ...(p.si ? { purposeIt: p.si } : {}),
    ...(p.o ? { optional: true } : {}), ...(p.t ? { toTaste: true } : {}),
    ...(p.alt ? { alternatives: p.alt.map(a => ({ ...amount(a), en: a.en, it: a.it })) } : {})
  })) };
}
export function consistentNames(records: { record: LineRecord; uses: number }[], overrides: Record<string, string>): { en: string; it: string; changed: number }[] {
  const counts = new Map<string, Map<string, number>>();
  const names = (r: LineRecord): LineAlternative[] => (r.parts ?? []).flatMap(p => [p, ...(p.alternatives ?? [])]);
  for (const { record, uses } of records) for (const p of names(record)) {
    const forms = counts.get(p.en) ?? new Map<string, number>();
    forms.set(p.it, (forms.get(p.it) ?? 0) + uses);
    counts.set(p.en, forms);
  }
  const choices = new Map<string, string>();
  const changes = new Map<string, number>();
  for (const [en, forms] of counts) {
    const it = overrides[en] ?? [...forms].sort((a,b) => b[1]-a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
    choices.set(en, it);
  }
  for (const { record } of records) for (const p of names(record)) {
    const it = choices.get(p.en)!;
    if (p.it !== it) { p.it = it; changes.set(p.en, (changes.get(p.en) ?? 0) + 1); }
  }
  const report = [...changes].map(([en, changed]) => ({ en, it: choices.get(en)!, changed }));
  return report.sort((a,b) => b.changed-a.changed || a.en.localeCompare(b.en));
}
export async function importLines(audit: string, directory = lineStoreDirectory, rereadFile = '.data/audit/reread.json') {
  const lines = JSON.parse(await readFile(join(audit, 'lines.json'), 'utf8')) as AuditLine[];
  const rows = new Map<number, AuditRow>();
  for (const file of (await readdir(join(audit, 'batches'))).filter(f => f.endsWith('.out')).sort()) {
    for (const text of (await readFile(join(audit, 'batches', file), 'utf8')).split('\n').filter(s => s.trim())) {
      const row = JSON.parse(text) as AuditRow;
      if (!Number.isInteger(row.i) || !lines[row.i] || rows.has(row.i) || (row.k && row.p)) throw new Error('Invalid or duplicate audit index');
      rows.set(row.i, row);
    }
  }
  if (rows.size !== lines.length) throw new Error('Incomplete audit');
  const records = lines.map((line, i) => ({ record: convertAudit(line, rows.get(i)!), uses: line.n, i }));
  const overrides = JSON.parse(await readFile(fileURLToPath(new URL('../data/line-names.json', import.meta.url)), 'utf8')) as Record<string, string>;
  const merged = consistentNames(records, overrides);
  const counts: Record<string, number> = {};
  const reread: { i: number; findings: ReturnType<typeof validateRecord> }[] = [];
  const shards: string[][] = Array.from({ length: 256 }, () => []);
  const keys = new Set<string>();
  let rejected = 0;
  for (const { record, i } of records.sort((a,b) => lineKey(a.record.language,a.record.line) < lineKey(b.record.language,b.record.line) ? -1 : 1)) {
    const findings = validateRecord(record);
    for (const f of findings) counts[f.code] = (counts[f.code] ?? 0) + 1;
    const review = findings.filter(f => f.severity === 'review');
    if (review.length) reread.push({ i, findings: review });
    if (findings.some(f => f.severity === 'error')) { rejected++; continue; }
    const key = lineKey(record.language, record.line);
    if (keys.has(key)) throw new Error('Normalized line collision');
    keys.add(key);
    shards[parseInt(lineShard(key),16)]!.push(JSON.stringify(record));
  }
  await mkdir(directory, { recursive: true });
  for (let i=0;i<256;i++) await writeFile(join(directory, i.toString(16).padStart(2,'0')+'.jsonl'), [JSON.stringify({ model: 'gpt-6.1-terra-medium', schema: 1 }), ...shards[i]!].join('\n')+'\n');
  await mkdir(dirname(rereadFile), { recursive: true });
  await writeFile(rereadFile, JSON.stringify(reread.sort((a,b)=>a.i-b.i), null, 2)+'\n');
  const report = { imported: keys.size, rejected, findings: counts, reread: reread.length, merged: merged.slice(0,30) };
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const audit = process.argv[process.argv.indexOf('--audit')+1];
  if (!process.argv.includes('--audit') || !audit) throw new Error('Usage: lines:import --audit <directory>');
  await importLines(audit);
}
