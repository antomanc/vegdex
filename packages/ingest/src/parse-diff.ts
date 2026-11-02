/**
 * `pnpm parse:diff <git-ref>`: parse every distinct catalog line with the parser at <ref> and the one in the
 * working tree, both against today's vocabulary, and report what changed. Run it before a parser change lands.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as current from '@vegdex/core';
import type { IngredientLookup, ParsedIngredient, Source } from '@vegdex/core';
import { loadStore } from './store';
import { loadVocabulary } from './vocab';

interface Parser {
  parseIngredient: typeof current.parseIngredient;
  /** Parsers since lines split into parts; older ones parse one ingredient per line. */
  parseLine?: (line: string, lookup: IngredientLookup, language: string) => ParsedIngredient[];
}

const root = path.resolve(import.meta.dirname, '../../..');
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  examples: { type: 'string', default: '5' },
  store: { type: 'string', default: path.join(root, '.data/store.json.gz') }
} });
const ref = positionals[0];
if (!ref) throw new Error('Usage: pnpm parse:diff <git-ref> [--examples 5]');

/** The core package as it was at `ref`; it has no dependencies, so its sources import as they are. */
async function parserAt(ref: string): Promise<Parser> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-parse-diff-'));
  const tar = execFileSync('git', ['archive', ref, 'packages/core/src'], { cwd: root, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return import(path.join(dir, 'packages/core/src/index.ts')) as Promise<Parser>;
}

const partsOf = (parser: Parser, line: string, lookup: IngredientLookup, language: string): ParsedIngredient[] =>
  parser.parseLine ? parser.parseLine(line, lookup, language) : [parser.parseIngredient(line, lookup, language)];

/** What a reader sees of a part: the fields that decide how it renders and what it buys. */
function summary(p: ParsedIngredient): string {
  const amount = p.quantity === null ? '' : `${p.quantity}${p.quantityMax !== null ? `-${p.quantityMax}` : ''}${p.unit ? ` ${p.unit}` : ''}`;
  const concept = p.concept ? `${p.concept}${p.conceptExact === true ? '' : '?'}${p.also ? ` ${p.also.joiner} ${p.also.concept}` : ''}` : `"${p.name}"`;
  return [p.kind ?? '', amount, concept].filter(Boolean).join(' · ');
}

const resolved = (parts: ParsedIngredient[]) => parts.every((p) => p.kind || !p.name || (p.concept && p.conceptExact === true));

function category(before: ParsedIngredient[], after: ParsedIngredient[]): string {
  if (before.length !== after.length) return after.length > before.length ? 'split' : 'unsplit';
  const [was, is] = [resolved(before), resolved(after)];
  if (was !== is) return is ? 'gained' : 'LOST';
  if (before.some((p, i) => (p.kind ?? '') !== (after[i]!.kind ?? ''))) return 'kind';
  if (before.some((p, i) => p.concept !== after[i]!.concept)) return is ? 'concept' : 'name (unresolved)';
  if (before.some((p, i) => p.quantity !== after[i]!.quantity || p.quantityMax !== after[i]!.quantityMax || p.unit !== after[i]!.unit)) return 'amount';
  return is ? 'other' : 'name (unresolved)';
}

const old = await parserAt(ref);
const vocab = loadVocabulary();
const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
const languageOf = new Map(sources.map((s) => [s.id, s.contentLanguage ?? 'en']));
const lines = new Map<string, [line: string, language: string]>();
for (const recipe of Object.values(loadStore(values.store!).recipes)) {
  const language = languageOf.get(recipe.sourceId);
  if (!language || !Object.hasOwn(current.languagePacks, language)) continue;
  for (const line of recipe.ingredients) lines.set(`${language}\t${line}`, [line, language]);
}

const changes = new Map<string, string[]>();
const rows: string[] = [];
for (const [line, language] of lines.values()) {
  const lookup = vocab.lookup(language);
  const before = partsOf(old, line, lookup, language);
  const after = partsOf(current, line, lookup, language);
  const [a, b] = [before.map(summary).join(' + '), after.map(summary).join(' + ')];
  if (a === b) continue;
  const kind = category(before, after);
  (changes.get(kind) ?? changes.set(kind, []).get(kind)!).push(`  ${line}\n      ${a}\n    → ${b}`);
  rows.push([kind, language, line, a, b].join('\t'));
}

console.log(`${lines.size} distinct lines, ${rows.length} changed against ${ref}`);
const sorted = [...changes].sort((x, y) => y[1].length - x[1].length);
for (const [kind, list] of sorted) console.log(`  ${kind.padEnd(18)} ${list.length}`);
for (const [kind, list] of sorted) {
  console.log(`\n## ${kind}`);
  for (const example of list.slice(0, Number(values.examples))) console.log(example);
}
const out = path.join(root, '.data/scratch/parse-diff.tsv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `category\tlanguage\tline\tbefore\tafter\n${rows.join('\n')}\n`);
console.log(`\nEvery change: ${path.relative(root, out)}`);
