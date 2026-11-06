import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lineKey, validateRecord, type LineRecord, type LineRecordFile } from '@vegdex/core';

export const lineStoreDirectory = fileURLToPath(new URL('../data/lines/', import.meta.url));
export function lineShard(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 2);
}
export async function loadLineRecords(directory = lineStoreDirectory): Promise<Map<string, LineRecord>> {
  const records = new Map<string, LineRecord>();
  for (const file of (await readdir(directory)).filter(f => /^[0-9a-f]{2}\.jsonl$/.test(f)).sort()) {
    const rows = (await readFile(join(directory, file), 'utf8')).trim().split('\n');
    const metadata = JSON.parse(rows.shift()!) as LineRecordFile;
    if (metadata.schema !== 1 || !metadata.model) throw new Error('Unsupported line record file');
    for (const row of rows.filter(Boolean)) {
      const r = JSON.parse(row) as LineRecord;
      if (validateRecord(r).some(f => f.severity === 'error')) throw new Error('Invalid line record');
      const key = lineKey(r.language, r.line);
      if (lineShard(key) + '.jsonl' !== file || records.has(key)) throw new Error('Duplicate or misplaced line record');
      records.set(key, r);
    }
  }
  return records;
}
/** Normalization finds a candidate; original text must also match. */
export function lookupLineRecord(records: Map<string, LineRecord>, language: string, line: string): LineRecord | undefined {
  const r = records.get(lineKey(language, line));
  return r?.line === line ? r : undefined;
}
