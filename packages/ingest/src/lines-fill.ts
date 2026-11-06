/**
 * `pnpm lines:fill` reads the crawl store, lists the distinct ingredient lines of published recipes that
 * still have no record, and writes one record per line by asking a model (or by applying a hand-written
 * `--answers` file). A line with no record keeps the parser path, so filling is a catch-up, never a gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { lineKey, validateRecord, type LineRecord, type Recipe, type Source } from '@vegdex/core';
import { answerLines, modelConfig } from './enrich';
import { applyNameChoices, convertAudit, lineShard, lineStoreDirectory, loadLineRecords, nameChoices, writeShard, type AuditRow } from './line-records';
import { prepareRecipes } from './prepare';
import { loadStore } from './store';
import { loadVocabulary, type Vocabulary } from './vocab';

const root = path.resolve(import.meta.dirname, '../../..');
const BATCH_SIZE = 100;

export interface MissingLine { lang: string; line: string; uses: number }

/** Distinct ingredient lines in the published catalog, keyed by `lineKey`, with how many recipes use each. */
export function publishedLines(recipes: Recipe[], sources: Source[], vocab: Vocabulary): Map<string, MissingLine> {
  const lines = new Map<string, MissingLine>();
  for (const { recipe } of prepareRecipes(recipes, sources, vocab).published) {
    const language = recipe.contentLanguage ?? 'en';
    for (const text of recipe.ingredients) {
      const key = lineKey(language, text);
      const entry = lines.get(key);
      if (entry) entry.uses++;
      else lines.set(key, { lang: language, line: text, uses: 1 });
    }
  }
  return lines;
}

/** Parse model JSON Lines (tolerating code-fence markers and a top-level JSON array) into answer rows. */
export function parseAnswerRows(text: string): AuditRow[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed) as AuditRow[];
  return trimmed.split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('```'))
    .map((s) => JSON.parse(s) as AuditRow);
}

export interface FillReport { accepted: number; skipped: number; rejected: { line: string; reason: string }[] }

/**
 * Convert each answer, normalize Italian names against line-names.json and the most-used form across the
 * corpus, then validate. Returns the accepted records and what was unanswered, malformed or rejected.
 * `usesOf` weights each existing record by its recipe count for the name majority.
 */
export function applyLineAnswers(
  missing: MissingLine[],
  existing: Map<string, LineRecord>,
  usesOf: (key: string) => number,
  answers: (AuditRow | null)[],
  overrides: Record<string, string>
): { accepted: { key: string; record: LineRecord }[]; report: FillReport } {
  const report: FillReport = { accepted: 0, skipped: 0, rejected: [] };
  const converted: { record: LineRecord; uses: number }[] = [];
  for (let i = 0; i < missing.length; i++) {
    const row = answers[i];
    const line = missing[i]!;
    if (!row) { report.skipped++; continue; }
    let record: LineRecord;
    try { record = convertAudit({ lang: line.lang, line: line.line, n: line.uses }, row); }
    catch { report.rejected.push({ line: line.line, reason: 'malformed' }); continue; }
    converted.push({ record, uses: line.uses });
  }
  const context = [...existing].map(([key, record]) => ({ record, uses: usesOf(key) })).concat(converted);
  applyNameChoices(converted.map((c) => c.record), nameChoices(context, overrides));
  const accepted: { key: string; record: LineRecord }[] = [];
  const seen = new Set(existing.keys());
  for (const { record } of converted) {
    const key = lineKey(record.language, record.line);
    if (seen.has(key)) { report.rejected.push({ line: record.line, reason: 'duplicate' }); continue; }
    seen.add(key);
    const errors = validateRecord(record).filter((f) => f.severity === 'error');
    if (errors.length) { report.rejected.push({ line: record.line, reason: errors.map((f) => f.code).join(',') }); continue; }
    accepted.push({ key, record });
  }
  report.accepted = accepted.length;
  return { accepted, report };
}

/** Merge accepted records into their shards, preserving sort order and the header of each existing shard. */
export function writeAccepted(directory: string, existing: Map<string, LineRecord>, accepted: { key: string; record: LineRecord }[], model: string): void {
  const merged = new Map(existing);
  const touched = new Set<string>();
  for (const { key, record } of accepted) { merged.set(key, record); touched.add(lineShard(key)); }
  for (const shard of touched) {
    const rows: [string, LineRecord][] = [];
    for (const [key, record] of merged) if (lineShard(key) === shard) rows.push([key, record]);
    writeShard(directory, shard, rows, model);
  }
}

export interface FillOptions {
  store: string;
  records: string;
  limit: number;
  dryRun: boolean;
  /** Path to a JSONL answers file, or answer each batch through `ask` (the endpoint). */
  answers?: string;
  ask?: (rows: string[]) => Promise<string | null>;
  model: string;
  log?: (msg: string) => void;
  err?: (msg: string) => void;
}

export interface FillSummary {
  missing: number;
  shown: number;
  accepted: number;
  skipped: number;
  rejected: FillReport['rejected'];
}

/** One fill run: find missing lines, answer them (file or endpoint), apply, validate and write the accepted. */
export async function fillLines(options: FillOptions): Promise<FillSummary> {
  const log = options.log ?? console.log;
  const err = options.err ?? console.error;
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
  const vocab = loadVocabulary();
  const records = loadLineRecords(options.records);
  const published = publishedLines(Object.values(loadStore(options.store).recipes), sources, vocab);
  const missing = [...published].filter(([key]) => !records.has(key)).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const capped = missing.slice(0, options.limit);

  if (options.dryRun) {
    const shown = capped.length < missing.length ? `; listing ${capped.length} (--limit ${options.limit})` : '';
    log(`${missing.length} catalog lines have no record${shown}`);
    for (let i = 0; i < capped.length; i++) {
      const [, line] = capped[i]!;
      log(`${i}\t${line.lang}\t${line.line}`);
    }
    return { missing: missing.length, shown: capped.length, accepted: 0, skipped: 0, rejected: [] };
  }

  const answers: (AuditRow | null)[] = new Array(capped.length).fill(null);
  if (options.answers) {
    const rows = parseAnswerRows(fs.readFileSync(options.answers, 'utf8'));
    for (const row of rows) if (Number.isInteger(row.i) && row.i >= 0 && row.i < capped.length) answers[row.i] = row;
  } else if (options.ask) {
    for (let offset = 0; offset < capped.length; offset += BATCH_SIZE) {
      const slice = capped.slice(offset, offset + BATCH_SIZE);
      const rows = slice.map(([, line], j) => `${offset + j}\t${line.lang}\t${line.line}`);
      const text = await options.ask(rows);
      if (text === null) { err(`batch ${offset / BATCH_SIZE + 1}: no usable response`); continue; }
      let parsed: AuditRow[];
      try { parsed = parseAnswerRows(text); }
      catch { err(`batch ${offset / BATCH_SIZE + 1}: unparseable response`); continue; }
      for (const row of parsed) if (Number.isInteger(row.i) && row.i >= offset && row.i < offset + slice.length) answers[row.i] = row;
    }
  }

  const overrides = JSON.parse(fs.readFileSync(new URL('../data/line-names.json', import.meta.url), 'utf8')) as Record<string, string>;
  const usesOf = (key: string) => published.get(key)?.uses ?? 0;
  const { accepted, report } = applyLineAnswers(capped.map(([, line]) => line), records, usesOf, answers, overrides);
  writeAccepted(options.records, records, accepted, options.model);
  log(`${report.accepted} accepted, ${report.skipped} unanswered, ${report.rejected.length} rejected`);
  for (const r of report.rejected) log(`  rejected ${JSON.stringify(r.line)}: ${r.reason}`);
  return { missing: missing.length, shown: capped.length, accepted: report.accepted, skipped: report.skipped, rejected: report.rejected };
}

const { values } = parseArgs({ options: {
  store: { type: 'string', default: path.join(root, '.data/store.json.gz') },
  records: { type: 'string', default: lineStoreDirectory },
  'dry-run': { type: 'boolean' },
  limit: { type: 'string', default: '500' },
  answers: { type: 'string' },
  help: { type: 'boolean' }
} });

async function main() {
  const limit = Number(values.limit ?? 500);
  if (values['dry-run'] || values.answers) {
    await fillLines({ store: values.store!, records: values.records!, limit, dryRun: values['dry-run'] ?? false, answers: values.answers, model: process.env.ENRICH_MODEL ?? 'agent' });
    return;
  }
  const config = modelConfig();
  const instructions = fs.readFileSync(new URL('../data/line-prompt.md', import.meta.url), 'utf8');
  await fillLines({ store: values.store!, records: values.records!, limit, dryRun: false, model: config.model, ask: (rows) => answerLines(config, instructions, rows) });
}

if (values.help) {
  console.log(`Give new ingredient lines records (see docs/agents/vocabulary.md):
  pnpm lines:fill [--store .data/store.json.gz] [--records packages/ingest/data/lines]
  pnpm lines:fill --dry-run                 print the lines with no record and write nothing
  pnpm lines:fill --limit 500               cap lines per run (a spending cap), default 500
  pnpm lines:fill --answers file.jsonl      apply JSONL answers instead of calling the endpoint
The endpoint is ENRICH_BASE_URL / ENRICH_MODEL (ENRICH_API_KEY optional), the same as pnpm enrich.`);
} else {
  try { await main(); }
  catch (error) {
    console.error(error instanceof Error && !/ENRICH|fetch/i.test(error.stack ?? '') ? error.message : 'Failed. Check ENRICH_BASE_URL / ENRICH_MODEL.');
    process.exitCode = 1;
  }
}
