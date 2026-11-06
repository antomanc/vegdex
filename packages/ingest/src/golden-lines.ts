/**
 * Build and refresh the golden ingredient lines under packages/core/test/golden/.
 *
 * `pnpm golden:select` picks the seeded sample from a built recipes.full.json and prints what would change;
 * `pnpm golden:select --update` writes it. `pnpm golden` re-renders the stored lines and prints changed output;
 * `pnpm golden --update` writes it. Review fields (status, class, expected, reviewNeeded) survive a reselect
 * for every line still in the sample, so a later fix promotes one line at a time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { ParsedIngredient } from '@vegdex/core';
import { applyLineRecord, parseLine, renderIngredient } from '@vegdex/core';
import { shippedLineRecord } from './line-records';
import { loadVocabulary, type Vocabulary } from './vocab';

const root = path.resolve(import.meta.dirname, '../../..');
const DEFAULT_DATA = path.join(root, 'apps/web/public/data/recipes.full.json');
const DEFAULT_OUT = path.join(root, 'packages/core/test/golden/ingredient-lines.json');
const DEFAULT_REVIEW = path.join(root, 'docs/review/italian-lines.md');
const DEFAULT_SEED = 20261105;
const RANDOM_ENGLISH = 300;
const HARD_PER_CLASS = 20;
const ITALIAN = 100;

export type Units = 'us' | 'metric';
export type GoldenStatus = 'ok' | 'known-bad' | 'unreviewed';
/** A vegan qualifier, B amount or "or" line, C qualifier or size, D ingredient, E Italian wording, F preparation. */
export type GoldenClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** What a reader sees of one part: the fields that decide its amount, name and Italian wording. */
export interface GoldenPart {
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  name: string;
  concept: string | null;
  conceptExact?: boolean;
  densityName?: string;
  kind?: 'heading' | 'other';
  note: string;
  terms: { id: string; text: string; inName?: true }[];
}

export interface GoldenLine {
  line: string;
  contentLanguage: string;
  source: string;
  status: GoldenStatus;
  class?: GoldenClass;
  reviewNeeded: boolean;
  parsed: GoldenPart[];
  /** The whole line in each language, parts joined with " + "; null when one part has no composed form. */
  en: string | null;
  it: string | null;
  expected?: { en: string | null; it: string | null };
}

export interface GoldenFile {
  generatedFrom: string;
  seed: number;
  units: Units;
  counts: { randomEnglish: number; hard: number; italianSource: number; total: number };
  lines: GoldenLine[];
}

const part = (p: ParsedIngredient): GoldenPart => ({
  quantity: p.quantity,
  quantityMax: p.quantityMax,
  unit: p.unit,
  name: p.name,
  concept: p.concept,
  ...(p.concept !== null ? { conceptExact: p.conceptExact === true } : {}),
  ...(p.densityName ? { densityName: p.densityName } : {}),
  ...(p.kind ? { kind: p.kind } : {}),
  note: p.note,
  terms: (p.terms ?? []).map((t) => ({ id: t.id, text: t.text, ...(t.inName ? { inName: true as const } : {}) }))
});

/** Parse one line and render it in English and Italian, the way the emit and the recipe sheet do. */
export function goldenLine(line: string, contentLanguage: string, vocab: Vocabulary, units: Units = 'metric'): Omit<GoldenLine, 'source' | 'status' | 'reviewNeeded'> {
  const parts = applyLineRecord(parseLine(line, vocab.lookup(contentLanguage), contentLanguage), shippedLineRecord(contentLanguage, line), vocab.lookup('en'), { en: vocab.display('en'), it: vocab.display('it') });
  const render = (language: string) => {
    const out = parts.map((p) => renderIngredient(p, vocab.display(language), language, units, contentLanguage));
    return out.every((part): part is [string, string] => part !== null) ? out.map(([amount, rest]) => `${amount} ${rest}`.trim()).join(' + ') : null;
  };
  return { line, contentLanguage, parsed: parts.map(part), en: render('en'), it: render('it') };
}

/** Mulberry32: a tiny seeded generator, so the same dataset and seed always pick the same lines. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], next: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface RealLine {
  line: string;
  contentLanguage: string;
  source: string;
}

function readLines(file: string): RealLine[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { recipes?: { contentLanguage?: string; source?: string; ingredients?: string[] }[] };
  if (!Array.isArray(data.recipes)) throw new Error(`${file}: expected a recipes array`);
  const out: RealLine[] = [];
  const seen = new Set<string>();
  for (const recipe of data.recipes) {
    const language = recipe.contentLanguage ?? 'en';
    for (const line of recipe.ingredients ?? []) {
      const key = `${language}\t${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ line, contentLanguage: language, source: recipe.source ?? '' });
    }
  }
  return out;
}

/** Lines a reader sees as an ingredient, not an instruction or a heading the parser hides. */
function ingredientLike(line: string, language: string, vocab: Vocabulary): boolean {
  if (!/\p{L}/u.test(line) || line.length > 180) return false;
  if (/^(?:for|to serve|serve|optional toppings|note|tip|see |if |when |how |preheat|heat |add |mix |stir |combine |place |put |cook |bake |remove |transfer |drain |wash |use |you |i |we |this |that )/iu.test(line)) return false;
  return parseLine(line, vocab.lookup(language), language).some((p) => !p.kind && !!p.name);
}

type Pattern = { re: RegExp; rank: number };
interface HardClass {
  id: GoldenClass;
  patterns: Pattern[];
}

/** Ordered patterns per error class: the first matching pattern ranks a line, then lines sort by text. */
const HARD: HardClass[] = [
  {
    id: 'A',
    patterns: [
      { rank: 0, re: /\b(?:vegan|dairy[- ]free)\b.*\b(?:gelato|gnocchi|biscotti|pasta sfoglia|pastry|ice cream|cookies?|biscuits?)\b/i },
      { rank: 1, re: /\b(?:gelato|gnocchi|biscotti|pasta sfoglia|pastry|ice cream|cookies?|biscuits?)\b.*\b(?:vegan|dairy[- ]free)\b/i },
      { rank: 2, re: /\b(?:vegan|dairy[- ]free)\b/i },
    ]
  },
  {
    id: 'B',
    patterns: [
      { rank: 0, re: /\bsugar\s+or\s+maple\b|\bmaple\s+syrup\s+or\s+sugar\b/i },
      { rank: 1, re: /\b(?:almond|soy|coconut|oat|cashew|rice)\b.*\bor\b.*\b(?:milk|drink)\b/i },
      { rank: 2, re: /\bnon[- ]dairy milk\b.*\b(?:or|like|such as)\b/i },
      { rank: 3, re: /\b(?:milk|syrup|sugar|water|juice|flour|oil)\b.*\bor\b/i },
      { rank: 4, re: /\bor\b/i }
    ]
  },
  {
    id: 'C',
    patterns: [
      { rank: 0, re: /\bcumin seeds\b|\bboiling water\b/i },
      { rank: 1, re: /\b(?:seeds|boiling)\b/i },
      { rank: 2, re: /\b(?:whole|ground|fresh|raw|toasted|crushed|blanched|peeled|finely|thinly|roughly)\b/i, }
    ]
  },
  {
    id: 'D',
    patterns: [
      { rank: 0, re: /\bgreen onion, sesame seeds\b/i },
      { rank: 1, re: /[^,]+, [^,]+, [^,]+,/ },
      { rank: 2, re: /[^,]+, [^,]+,[^)]/ },
      { rank: 3, re: /\band\b[^,]*,[^,]*,[^,]*/i }
    ]
  },
  {
    id: 'E',
    patterns: [
      { rank: 0, re: /\bhead\b.*\b(?:lettuce|cauliflower|cabbage)\b|\b(?:lettuce|cauliflower|cabbage)\b.*\bhead\b/i },
      { rank: 1, re: /\b(?:sliced|slivered|flaked|toasted)\b.*\b(?:almonds?|nuts?|pistachios?)\b|\b(?:almonds?|nuts?|pistachios?)\b.*\b(?:sliced|slivered|flaked|toasted)\b/i },
      { rank: 2, re: /\b(?:medium|large|small)\b.*\b(?:tomatoes|carrots|onions|potatoes|apples|bananas|cucumbers)\b/i },
      { rank: 3, re: /\b(?:tomatoes|carrots|onions|potatoes|apples|almonds|leaves)\b/i }
    ]
  }
];

/**
 * Pick 20 lines per class. A line belongs to the first class that matches it, so classes never overlap.
 * Within a class, lines where today's output already shows the class symptom come first, then the earliest
 * pattern, then text: the sample stays reproducible and useful.
 */
function pickHard(lines: RealLine[], vocab: Vocabulary, used: Set<string>): RealLine[] {
  const out: RealLine[] = [];
  const chosen = new Set<string>();
  const need = HARD.map(() => HARD_PER_CLASS);
  const symptom = (cls: GoldenClass, line: RealLine): number => {
    const golden = goldenLine(line.line, line.contentLanguage, vocab);
    if (cls === 'A') return golden.it && !/\b(?:vegan\p{L}*|vegetal\p{L}*|senza latticini|dairy[- ]free|plant[- ]based)\b/iu.test(golden.it) ? 0 : 1;
    if (cls === 'B') {
      // A liquid measured by cup or pint turning into grams is the wrong-amount symptom.
      return golden.en && /(?:milk|water|juice|broth|wine|cream)/iu.test(line.line) && /cup|pint|quart|ounce|oz/iu.test(line.line) && /\b\d+(?:[.,]\d+)?\s*g\b/u.test(golden.en) ? 0 : 1;
    }
    if (cls === 'D') {
      const items = line.line.replace(/\([^)]*\)/g, ' ').split(/[,&]|\s(?:and|or)\s/iu).map((x) => x.trim()).filter(Boolean);
      return items.length >= 3 ? 0 : items.length === 2 ? 1 : 2;
    }
    if (cls === 'E') {
      return golden.it && (/\b(?:medii|grandii|piccolii)\b|\b(?:cespo|cucchiaio|cucchiaino|tazza|manciata) di [^,]*\b(?:lattughe|cavolfiori|cavoli|fagioli|piselli|mandorle|noci)\b|\b(?:mandorle|noci|patate|carote|cipolle|mele)\b[^,]*?\b(?:tostati|arrostiti|tritati|tagliati|pelati)\b/iu.test(golden.it)) ? 0 : 1;
    }
    return 0;
  };
  const candidates = HARD.map((c) => lines
    .map((l) => ({ line: l, hit: c.patterns.find((p) => p.re.test(l.line)) }))
    .filter((x): x is { line: RealLine; hit: Pattern } => !!x.hit)
    .sort((a, b) => symptom(c.id, a.line) - symptom(c.id, b.line) || a.hit.rank - b.hit.rank || a.line.line.localeCompare(b.line.line)));
  // A line matching several classes is only used once; later classes take the next candidate.
  for (const [index, cls] of HARD.entries()) {
    for (const { line } of candidates[index]!) {
      if (need[index] === 0) break;
      const key = line.contentLanguage + '\t' + line.line;
      if (used.has(key) || chosen.has(key)) continue;
      // Class A and E mean what the Italian render does with the source; skip lines it cannot render.
      if ((cls.id === 'A' || cls.id === 'E') && goldenLine(line.line, line.contentLanguage, vocab).it === null) continue;
      chosen.add(key);
      out.push(line);
      need[index]!--;
    }
  }
  // A class short on candidates borrows the first unused hard-shaped line, so the sample keeps its size.
  for (let i = 0; i < HARD.length; i++) {
    for (const { line } of candidates.flat()) {
      if (need[i] === 0) break;
      const key = line.contentLanguage + '\t' + line.line;
      if (used.has(key) || chosen.has(key)) continue;
      chosen.add(key);
      out.push(line);
      need[i]!--;
    }
  }
  return out;
}

function label(line: GoldenLine): string {
  return `${line.contentLanguage}: ${line.line}`;
}

/** What changed between a stored line and its recomputed output. */
function diff(stored: GoldenLine, current: GoldenLine): string[] {
  const changes: string[] = [];
  if (stored.en !== current.en) changes.push(`  en: ${JSON.stringify(stored.en)}\n   → ${JSON.stringify(current.en)}`);
  if (stored.it !== current.it) changes.push(`  it: ${JSON.stringify(stored.it)}\n   → ${JSON.stringify(current.it)}`);
  if (JSON.stringify(stored.parsed) !== JSON.stringify(current.parsed)) changes.push(`  parsed: ${JSON.stringify(stored.parsed)}\n     → ${JSON.stringify(current.parsed)}`);
  return changes;
}

function toGolden(real: RealLine[], vocab: Vocabulary, previous: Map<string, GoldenLine>): GoldenLine[] {
  return real.map(({ line, contentLanguage, source }) => {
    const key = `${contentLanguage}\t${line}`;
    const computed = goldenLine(line, contentLanguage, vocab);
    const old = previous.get(key);
    return {
      ...computed,
      source,
      status: old?.status ?? 'unreviewed',
      ...(old?.class ? { class: old.class } : {}),
      reviewNeeded: old?.reviewNeeded ?? false,
      ...(old?.expected ? { expected: old.expected } : {})
    };
  });
}

function readPrevious(file: string): Map<string, GoldenLine> {
  if (!fs.existsSync(file)) return new Map();
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as GoldenFile;
  return new Map(data.lines.map((l) => [`${l.contentLanguage}\t${l.line}`, l]));
}

/** The review sheet: the lines marked reviewNeeded, each with its current Italian wording and a proposal. */
export function reviewMarkdown(golden: GoldenFile): string {
  const rows = golden.lines
    .filter((l) => l.reviewNeeded)
    .sort((a, b) => (a.status === 'known-bad' ? -1 : 0) - (b.status === 'known-bad' ? -1 : 0) || a.line.localeCompare(b.line));
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = [
    '# Italian ingredient lines to review',
    '',
    `Generated from the golden set (${golden.units} renders). Each row is one real source line, the wording the app shows in Italian today, and the correction the golden set expects when the output is known-bad. Empty proposals are worth a native speaker’s eye but are not known-bad.`,
    '',
    '| # | Source line | Current Italian | Proposed correction | Class |',
    '| --- | --- | --- | --- | --- |'
  ];
  rows.forEach((l, i) => {
    const proposal = l.status === 'known-bad' ? (l.expected?.it ?? '') : '';
    lines.push(`| ${i + 1} | ${cell(l.line)} | ${cell(l.it ?? '(shown as written; no composed Italian)')} | ${cell(proposal)} | ${l.class ?? ''} |`);
  });
  return lines.join('\n') + '\n';
}

function main(): void {
  const { values } = parseArgs({ options: {
    data: { type: 'string' },
    out: { type: 'string', default: DEFAULT_OUT },
    review: { type: 'string', default: DEFAULT_REVIEW },
    seed: { type: 'string', default: String(DEFAULT_SEED) },
    select: { type: 'boolean', default: false },
    update: { type: 'boolean', default: false }
  } });
  const dataPath = path.resolve(values.data ?? DEFAULT_DATA);
  const outPath = path.resolve(values.out!);
  const reviewPath = path.resolve(values.review!);
  const seed = Number(values.seed);
  const vocab = loadVocabulary();
  const previous = readPrevious(outPath);

  let next: GoldenFile;
  if (values.select) {
    if (!fs.existsSync(dataPath)) throw new Error(`No dataset at ${dataPath}; build one with \`pnpm ingest emit --out apps/web/public/data\` or pass --data <file>.`);
    const all = readLines(dataPath);
    const english = all.filter((l) => l.contentLanguage === 'en' && ingredientLike(l.line, 'en', vocab)).sort((a, b) => a.line.localeCompare(b.line));
    const italian = all.filter((l) => l.contentLanguage === 'it' && ingredientLike(l.line, 'it', vocab)).sort((a, b) => a.line.localeCompare(b.line));
    const used = new Set<string>();
    const hard = pickHard(english, vocab, used);
    for (const h of hard) used.add(`${h.contentLanguage}\t${h.line}`);
    const randomLines = shuffle(english, random(seed)).filter((l) => !used.has(`${l.contentLanguage}\t${l.line}`)).slice(0, RANDOM_ENGLISH);
    const italianLines = shuffle(italian, random(seed + 1)).slice(0, ITALIAN);
    const selected = [...randomLines, ...hard, ...italianLines];
    next = {
      generatedFrom: path.basename(dataPath),
      seed,
      units: 'metric',
      counts: { randomEnglish: randomLines.length, hard: hard.length, italianSource: italianLines.length, total: selected.length },
      lines: toGolden(selected, vocab, previous)
    };
    console.log(`selected ${randomLines.length} random English, ${hard.length} hard, ${italianLines.length} Italian-source lines`);
  } else {
    if (!fs.existsSync(outPath)) throw new Error(`No golden file at ${outPath}; run \`pnpm golden:select --update\` first.`);
    const stored = JSON.parse(fs.readFileSync(outPath, 'utf8')) as GoldenFile;
    next = { ...stored, lines: stored.lines.map((l) => ({ ...goldenLine(l.line, l.contentLanguage, vocab), source: l.source, status: l.status, ...(l.class ? { class: l.class } : {}), reviewNeeded: l.reviewNeeded, ...(l.expected ? { expected: l.expected } : {}) })) };
  }

  const changed = next.lines.filter((l) => {
    const old = previous.get(`${l.contentLanguage}\t${l.line}`);
    return !old || diff(old, l).length > 0;
  });
  for (const l of changed) {
    const old = previous.get(`${l.contentLanguage}\t${l.line}`);
    console.log(`\n${label(l)}`);
    if (!old) console.log('  new');
    else for (const line of diff(old, l)) console.log(line);
  }
  console.log(`\n${next.lines.length} lines, ${changed.length} changed, ${next.lines.filter((l) => l.status === 'known-bad').length} known-bad, ${next.lines.filter((l) => l.status === 'ok').length} ok, ${next.lines.filter((l) => l.status === 'unreviewed').length} unreviewed`);

  if (values.update) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(next, null, 2) + '\n');
    if (values.select && fs.existsSync(reviewPath)) fs.rmSync(reviewPath);
    fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
    fs.writeFileSync(reviewPath, reviewMarkdown(next));
    console.log(`wrote ${path.relative(root, outPath)} and ${path.relative(root, reviewPath)}`);
  } else {
    console.log('dry run: pass --update to write the golden file and review sheet');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
