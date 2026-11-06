import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lineKey, validateRecord, type LineAlternative, type LineAmount, type LinePart, type LineRecord, type LineRecordFile } from '@vegdex/core';

export const lineStoreDirectory = fileURLToPath(new URL('../data/lines/', import.meta.url));
export function lineShard(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 2);
}
export function loadLineRecords(directory = lineStoreDirectory): Map<string, LineRecord> {
  const records = new Map<string, LineRecord>();
  for (const file of readdirSync(directory).filter(f => /^[0-9a-f]{2}\.jsonl$/.test(f)).sort()) {
    for (const [key, record] of loadShard(directory, file)) records.set(key, record);
  }
  return records;
}
function loadShard(directory: string, file: string): Map<string, LineRecord> {
  const records = new Map<string, LineRecord>();
  const rows = readFileSync(join(directory, file), 'utf8').trim().split('\n');
  const metadata = JSON.parse(rows.shift()!) as LineRecordFile;
  if (metadata.schema !== 1 || !metadata.model) throw new Error('Unsupported line record file');
  for (const row of rows.filter(Boolean)) {
    const r = JSON.parse(row) as LineRecord;
    if (validateRecord(r).some(f => f.severity === 'error')) throw new Error('Invalid line record');
    const key = lineKey(r.language, r.line);
    if (lineShard(key) + '.jsonl' !== file || records.has(key)) throw new Error('Duplicate or misplaced line record');
    records.set(key, r);
  }
  return records;
}
/** Normalization finds a candidate; original text must also match. */
export function lookupLineRecord(records: Map<string, LineRecord>, language: string, line: string): LineRecord | undefined {
  const r = records.get(lineKey(language, line));
  return r?.line === line ? r : undefined;
}

const shards = new Map<string, Map<string, LineRecord>>();
export function shippedLineRecord(language: string, line: string): LineRecord | undefined {
  const file = lineShard(lineKey(language, line)) + '.jsonl';
  if (!shards.has(file)) shards.set(file, loadShard(lineStoreDirectory, file));
  return lookupLineRecord(shards.get(file)!, language, line);
}

// --- Turning model answer rows into LineRecords (shared by the one-time import and `lines:fill`) ---
export interface AuditAmount { q?: number; m?: number; u?: string }
export interface AuditPart extends AuditAmount {
  en: string; it: string; plus?: AuditAmount; pe?: string; pi?: string; s?: string; si?: string; o?: number; t?: number;
  alt?: (AuditAmount & { en: string; it: string })[];
}
export interface AuditRow { i: number; k?: 'h' | 'o'; p?: AuditPart[] }
export interface AuditLine { lang: string; line: string; n: number }

const auditAmount = (a: AuditAmount): LineAmount => ({
  ...(a.q !== undefined ? { quantity: a.q } : {}), ...(a.m !== undefined ? { quantityMax: a.m } : {}), ...(a.u !== undefined ? { unit: a.u } : {})
});

export function convertAudit(line: AuditLine, row: AuditRow): LineRecord {
  if (row.k) return { line: line.line, language: line.lang, kind: row.k === 'h' ? 'heading' : 'other' };
  return { line: line.line, language: line.lang, parts: row.p?.map((p): LinePart => ({
    ...auditAmount(p), en: p.en, it: p.it,
    ...(p.plus ? { plus: auditAmount(p.plus) } : {}),
    ...(p.pe ? { preparationEn: p.pe } : {}), ...(p.pi ? { preparationIt: p.pi } : {}),
    ...(p.s ? { purposeEn: p.s } : {}), ...(p.si ? { purposeIt: p.si } : {}),
    ...(p.o ? { optional: true } : {}), ...(p.t ? { toTaste: true } : {}),
    ...(p.alt ? { alternatives: p.alt.map((a) => ({ ...auditAmount(a), en: a.en, it: a.it })) } : {})
  })) };
}

const recordParts = (r: LineRecord): LineAlternative[] => (r.parts ?? []).flatMap((p) => [p, ...(p.alternatives ?? [])]);

/** The Italian name every English name resolves to: line-names.json first, then the most-used form. */
export function nameChoices(records: { record: LineRecord; uses: number }[], overrides: Record<string, string>): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const { record, uses } of records) for (const p of recordParts(record)) {
    const forms = counts.get(p.en) ?? new Map<string, number>();
    forms.set(p.it, (forms.get(p.it) ?? 0) + uses);
    counts.set(p.en, forms);
  }
  const choices = new Map<string, string>();
  for (const [en, forms] of counts) {
    const it = overrides[en] ?? [...forms].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
    choices.set(en, it);
  }
  return choices;
}

export function applyNameChoices(records: LineRecord[], choices: Map<string, string>): { en: string; it: string; changed: number }[] {
  const changes = new Map<string, number>();
  for (const record of records) for (const p of recordParts(record)) {
    const it = choices.get(p.en)!;
    if (p.it !== it) { p.it = it; changes.set(p.en, (changes.get(p.en) ?? 0) + 1); }
  }
  return [...changes].map(([en, changed]) => ({ en, it: choices.get(en)!, changed })).sort((a, b) => b.changed - a.changed || a.en.localeCompare(b.en));
}

/** Run a whole batch through name normalization: overrides and the weighted majority for each English name. */
export function consistentNames(records: { record: LineRecord; uses: number }[], overrides: Record<string, string>): { en: string; it: string; changed: number }[] {
  return applyNameChoices(records.map((r) => r.record), nameChoices(records, overrides));
}

/** Rewrite one shard: existing rows keep their header and order, new rows slot in by key. */
export function writeShard(directory: string, shard: string, rows: [key: string, record: LineRecord][], model: string): void {
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  mkdirSync(directory, { recursive: true });
  const file = join(directory, shard + '.jsonl');
  const header = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8').split('\n', 1)[0]!) as LineRecordFile).model : model;
  writeFileSync(file, [JSON.stringify({ model: header, schema: 1 }), ...rows.map(([, r]) => JSON.stringify(r))].join('\n') + '\n');
}

/** Write every record into its shard, each shard sorted by key. */
export function writeLineRecords(directory: string, records: Map<string, LineRecord>, model: string): void {
  const shards = new Map<string, [string, LineRecord][]>();
  for (const [key, record] of records) {
    const list = shards.get(lineShard(key)) ?? [];
    list.push([key, record]);
    shards.set(lineShard(key), list);
  }
  for (const [shard, rows] of shards) writeShard(directory, shard, rows, model);
}
