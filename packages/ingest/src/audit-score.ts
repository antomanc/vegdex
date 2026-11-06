/** Auditor opinions are diagnostic flags, never publishing decisions. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseLine, renderIngredient, isHiddenLine, type ParsedIngredient } from '@vegdex/core';
import { loadVocabulary } from './vocab';

const families = ['amount', 'range', 'plus', 'parts', 'label hides ingredients', 'not an ingredient', 'alternative', 'qualifier', 'preparation', 'no Italian', 'no English', 'Italian wording', 'vegan'] as const;
type Family = typeof families[number];
interface Part {
  q?: number; m?: number; u?: string; plus?: { q: number; m?: number; u?: string };
  en?: string; it?: string; pe?: string; pi?: string; alt?: Part[];
}
interface Answer { i: number; k?: 'h' | 'o'; p?: Part[] }
interface Line { lang: string; line: string; n: number }
type Snapshot = Record<Family, number[]>;
const STOP = new Set('the of and or to for into with in a an as at on about plus more your any if use using such like each per by from di del della dello dei delle degli al alla allo ai alle agli e o ed in per con da il la le lo i gli un una uno g ml kg l tsp tbsp cup cups oz lb small'.split(' '));
const stem = (w: string) => w.replace(/ies$/, 'y').replace(/(es|s)$/, '').replace(/[aeio]$/, '');
const words = (s = '') => (s.toLowerCase().replace(/[’']/g, ' ').match(/[a-zà-ù]+/g) ?? []).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
const units: Record<string, string> = { tablespoon: 'tbsp', teaspoon: 'tsp', ounce: 'oz', pound: 'lb', gram: 'g', liter: 'l', litre: 'l', milliliter: 'ml', cups: 'cup' };
const unit = (u?: string | null) => u ? units[u] ?? u : null;
const equal = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.02);
const plant = /vegan|plant|dairy[- ]?free|non[- ]?dairy|vegetal|senza latt|\bsoy|almond|\boat|coconut|cashew|rice milk|\bnut\b|seed butter|peanut|hemp|seitan|tofu|tempeh|nutritional|egg substitute|flax|(?:hazelnut|walnut|pecan|pistachio|macadamia|brazil nut|sunflower|sesame|pumpkin seed|cocoa|cacao) butter/i;
const risky = /\b(butter|milk|cheese|mayo|mayonnaise|yogurt|yoghurt|honey|sausage|chicken|cream|parmesan|mozzarella|cheddar|beef|bacon|egg|eggs|gelatin|ghee|feta|ricotta)\b/i;
const volume: Record<string, number> = { cup: 240, tbsp: 15, tsp: 5, ml: 1, l: 1000 };

/** Pure comparison; word overlap deliberately remains a noisy review signal. */
export function compare(line: Line, answer: Answer, parts: ParsedIngredient[], en: string | null, it: string | null): Family[] {
  const flags = new Set<Family>();
  const expected = answer.p ?? [];
  const hidden = parts.length === 1 && isHiddenLine(parts[0], 'en', line.lang);
  const kind = parts.some(p => p.kind === 'heading') ? 'h' : parts.some(p => p.kind === 'other') || hidden ? 'o' : 'i';
  if ((answer.k ?? 'i') !== kind) {
    flags.add(!answer.k ? 'label hides ingredients' : 'not an ingredient');
  } else if (!answer.k) {
    if (it === null) flags.add('no Italian');
    if (en === null) flags.add('no English');
    const first = parts[0];
    const a = expected[0];
    if (first && a) {
      const measures = [{ quantity: first.quantity, unit: first.unit }, first.metric, first.size].filter(p => p != null);
      if (a.q != null && parts.length === 1 && !a.plus && !measures.some(p => equal(a.q, p.quantity) && unit(a.u) === unit(p.unit))) flags.add('amount');
      if (a.m != null && !equal(a.m, first.quantityMax)) flags.add('range');
      if (a.plus) {
        const factor = volume[unit(a.u) ?? ''];
        const extra = volume[unit(a.plus.u) ?? ''];
        const total = a.q != null && factor && extra ? a.q * factor + a.plus.q * extra : null;
        const summed = total != null && measures.some(p => equal(total, p.quantity == null ? null : p.quantity * (volume[unit(p.unit) ?? ''] ?? NaN)));
        const split = parts.slice(1).some(p => equal(a.plus!.q, p.quantity) && unit(a.plus!.u) === unit(p.unit));
        if (!summed && !split) flags.add('plus');
      }
    }
    if (expected.length > parts.length) flags.add('parts');
    const shown = new Set(words(en ?? '')), shownIt = new Set(words(it ?? ''));
    const missing = (s: string | undefined, set: Set<string>) => words(s).some(w => !set.has(w));
    for (const p of expected) {
      if (en !== null) {
        if (missing(p.en, shown)) flags.add('qualifier');
        if (missing(p.pe, shown)) flags.add('preparation');
        if (p.alt?.some(a => missing(a.en, shown))) flags.add('alternative');
      }
      if (it !== null && missing(p.it, shownIt)) flags.add('Italian wording');
    }
  }
  if (en && risky.test(en) && !plant.test(en) && plant.test([line.line, ...expected.map(p => `${p.en ?? ''} ${p.it ?? ''}`)].join(' '))) flags.add('vegan');
  return [...flags];
}

/** Compare identities, rather than count differences that can conceal regressions. */
export function changes(before: number[], after: number[]) {
  const old = new Set(before), current = new Set(after);
  return { fixed: before.filter(i => !current.has(i)), added: after.filter(i => !old.has(i)) };
}

function main() {
  const root = path.resolve(import.meta.dirname, '../../..');
  const { values } = parseArgs({ options: { audit: { type: 'string', default: path.join(root, '.data/audit') }, save: { type: 'string' }, against: { type: 'string' } } });
  const dir = values.audit;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`Audit directory missing: ${dir}. Supply --audit <dir> with lines.json and batches/*.out.`);
  const lines: Line[] = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8'));
  const answers = new Map<number, Answer>();
  for (const file of fs.readdirSync(path.join(dir, 'batches')).filter(f => f.endsWith('.out')).sort()) {
    for (const row of fs.readFileSync(path.join(dir, 'batches', file), 'utf8').split('\n').filter(s => s.trim())) {
      const answer: Answer = JSON.parse(row);
      if (!Number.isInteger(answer.i) || !lines[answer.i] || answers.has(answer.i) || (!answer.k && !answer.p?.length)) throw new Error(`Invalid or duplicate audit answer in ${file}: ${answer.i}`);
      answers.set(answer.i, answer);
    }
  }
  const vocab = loadVocabulary();
  const snapshot = Object.fromEntries(families.map(f => [f, [] as number[]])) as Snapshot;
  let clean = 0, cleanUses = 0;
  for (const [i, line] of lines.entries()) {
    const answer = answers.get(i);
    if (!answer) throw new Error(`Missing audit answer for line ${i}`);
    const parts = parseLine(line.line, vocab.lookup(line.lang), line.lang);
    const render = (language: string) => {
      const out = parts.map(p => renderIngredient(p, vocab.display(language), language, 'metric', line.lang));
      return out.every((p): p is [string, string] => p !== null) ? out.map(p => p.join(' ').trim()).join(' + ') : null;
    };
    const flags = compare(line, answer, parts, render('en'), render('it'));
    for (const f of flags) snapshot[f].push(i);
    if (!flags.length) { clean++; cleanUses += line.n; }
  }
  console.log('Auditor comparison flags (wording flags are noisy; families overlap).');
  console.log(`${'family'.padEnd(25)} ${'lines'.padStart(8)} ${'uses'.padStart(8)}`);
  for (const f of families) console.log(`${f.padEnd(25)} ${String(snapshot[f].length).padStart(8)} ${String(snapshot[f].reduce((n, i) => n + lines[i]!.n, 0)).padStart(8)}`);
  console.log(`${'clean'.padEnd(25)} ${String(clean).padStart(8)} ${String(cleanUses).padStart(8)}`);
  if (values.against) {
    const before: Snapshot = JSON.parse(fs.readFileSync(values.against, 'utf8'));
    for (const f of families) {
      if (!Array.isArray(before[f]) || before[f].some(i => !Number.isInteger(i) || !lines[i])) throw new Error(`Invalid baseline family: ${f}`);
      const { fixed, added } = changes(before[f], snapshot[f]);
      console.log(`${f}: ${fixed.length} fixed, ${added.length} new`);
      for (const [label, indexes] of [['fixed', fixed], ['new', added]] as const) for (const i of indexes.slice(0, 5)) console.log(`  ${label} [${i}] ${lines[i]!.line}`);
    }
  }
  if (values.save) fs.writeFileSync(values.save, JSON.stringify(snapshot, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
