import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Source } from '@vegdex/core';
import { answerBatch, modelConfig } from './enrich';
import { applyAnswers, buildBatch, type Answers, type Batch } from './fill';
import { fillPayoff, findGaps, gapsIn, measureCoverage, score, type GapKind } from './gaps';
import { prepareRecipes } from './prepare';
import { loadStore } from './store';
import { loadVocabulary, writeAtomic, writeVocabulary } from './vocab';

const root = path.resolve(import.meta.dirname, '../../..');
const KINDS: GapKind[] = ['map', 'term', 'name', 'title'];
const HELP = `Vocabulary fill loop (see docs/agents/vocabulary.md):
  pnpm coverage [--top 15] [--sample]                 score per language and the largest gaps; --sample adds an
                                                      example line per gap and the gap lines the top N gaps of each kind cover
  pnpm gaps --kind <map|term|name|title> --lang <code> [--size 50] [--batches 1]
                                                      write batch files to .data/fill/
  pnpm vocab:apply <file.answers.json> ...            check answers and merge them into data/vocab/
  pnpm enrich --kind <kind> --lang <code> [--size 40] [--batches 5]
                                                      answer batches with ENRICH_BASE_URL / ENRICH_MODEL (ENRICH_API_KEY optional)
Map and term gaps take the language recipes are written in; name and title gaps the language to display.`;

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  kind: { type: 'string' }, lang: { type: 'string' }, size: { type: 'string' }, batches: { type: 'string', default: '1' },
  store: { type: 'string', default: path.join(root, '.data/store.json.gz') }, top: { type: 'string', default: '15' }, sample: { type: 'boolean' }, help: { type: 'boolean' }
} });
const [command, ...files] = positionals;

/** The crawl store lives in the data release; fetch it on first use. */
function prepared() {
  if (!fs.existsSync(values.store!)) {
    console.error('Downloading the crawl store from the data release…');
    execFileSync('gh', ['release', 'download', 'data', '--pattern', 'store.json.gz', '--dir', path.dirname(values.store!)], { stdio: 'inherit' });
  }
  const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
  const vocab = loadVocabulary();
  const { published, held } = prepareRecipes(Object.values(loadStore(values.store!).recipes), sources, vocab);
  return { vocab, recipes: [...published, ...held] };
}

function kindAndLanguage(): [GapKind, string] {
  const kind = values.kind as GapKind;
  if (!KINDS.includes(kind) || !values.lang) throw new Error(`Use --kind ${KINDS.join('|')} --lang <code>`);
  return [kind, values.lang];
}

const batchPath = (kind: GapKind, language: string, n: number) =>
  path.join(root, '.data/fill', `${language}-${kind}-${String(n).padStart(3, '0')}.json`);

const PAYOFF_SIZES = [10, 25, 50, 100, 250];

function coverage() {
  const { vocab, recipes } = prepared();
  const { coverage: result, gaps: all } = measureCoverage(recipes, vocab, Object.keys(vocab.files));
  for (const [language, c] of Object.entries(result.languages)) {
    const s = score(c);
    console.log(`\n${language}: ${s.rendered}% of ${c.lines} lines rendered, ${s.unknown}% unknown ingredients, ${c.unnamed} lines missing a name, ${c.kept} kept as written; ${s.titles}% of ${c.titles} titles`);
    const own = gapsIn(all, language);
    for (const gap of own.slice(0, Number(values.top)))
      console.log(`  ${gap.kind.padEnd(5)} ${String(gap.lines).padStart(6)}  ${gap.id}${values.sample ? `  e.g. ${gap.examples[0]}` : ''}`);
    if (!values.sample) continue;
    // What filling the largest N gaps of a kind would cover, to size `pnpm gaps --size --batches`.
    console.log('  gap lines covered by the largest N gaps of each kind (a line with two gaps counts twice):');
    for (const kind of KINDS) {
      const ofKind = own.filter((g) => g.kind === kind);
      // The last step always takes every gap of the kind, so it holds the total.
      const steps = fillPayoff(ofKind, [...PAYOFF_SIZES, Infinity]);
      if (!steps.length) continue;
      const total = steps.at(-1)!.lines;
      // Floor, so 100% only shows once every gap of the kind is in.
      const shown = steps.map((p) => `${p.gaps}: ${p.lines} (${Math.floor((1000 * p.lines) / total) / 10}%)`);
      console.log(`    ${kind.padEnd(5)} top ${shown.join(' · ')}`);
    }
  }
}

function gaps() {
  const [kind, language] = kindAndLanguage();
  const { vocab, recipes } = prepared();
  const all = findGaps(recipes, vocab, Object.keys(vocab.files));
  const size = Number(values.size ?? 50);
  for (let n = 0; n < Number(values.batches); n++) {
    const batch = buildBatch(vocab, all, kind, language, size, n * size);
    if (!batch.items.length) break;
    const file = batchPath(kind, language, n + 1);
    // One item per line: small for a model to read, easy for a person to skim.
    const { items, ...head } = batch;
    writeAtomic(file, `${JSON.stringify(head).slice(0, -1)},"items":[\n${items.map((i) => JSON.stringify(i)).join(',\n')}\n]}\n`);
    console.log(`${path.relative(root, file)}: ${batch.items.length} items covering ${batch.items.reduce((a, i) => a + i.lines, 0)} lines`);
  }
}

function apply() {
  if (!files.length) throw new Error('Pass the answer files: pnpm vocab:apply .data/fill/it-name-001.answers.json');
  const vocab = loadVocabulary();
  // pnpm --filter runs this from the package directory; paths are the caller's.
  for (const file of files.map((f) => path.resolve(process.env.INIT_CWD ?? process.cwd(), f))) {
    const answers = JSON.parse(fs.readFileSync(file, 'utf8')) as Answers;
    const batch = JSON.parse(fs.readFileSync(file.replace(/\.answers\.json$/, '.json'), 'utf8')) as Batch;
    if (answers.kind !== batch.kind || answers.language !== batch.language) throw new Error(`${file} does not answer its batch`);
    const report = applyAnswers(vocab, batch, answers.answers ?? {});
    console.log(`${path.relative(root, file)}: ${report.accepted} accepted, ${report.skipped} skipped, ${report.rejected.length} rejected`);
    for (const r of report.rejected) console.log(`  rejected ${r.id}: ${r.reason}`);
  }
  writeVocabulary(vocab);
}

async function enrich() {
  const [kind, language] = kindAndLanguage();
  const config = modelConfig();
  const { recipes } = prepared();
  const size = Number(values.size ?? 40);
  let vocab = loadVocabulary();
  const all = findGaps(recipes, vocab, Object.keys(vocab.files));
  const totals = { accepted: 0, skipped: 0, rejected: 0 };
  for (let n = 0; n < Number(values.batches); n++) {
    const batch = buildBatch(vocab, all, kind, language, size, n * size);
    if (!batch.items.length) break;
    const answers = await answerBatch(batch, config);
    if (!answers) { console.error(`batch ${n + 1}: no usable response`); continue; }
    const report = applyAnswers(vocab, batch, answers);
    writeVocabulary(vocab);
    vocab = loadVocabulary();
    totals.accepted += report.accepted; totals.skipped += report.skipped; totals.rejected += report.rejected.length;
    console.log(`batch ${n + 1}: ${report.accepted} accepted, ${report.skipped} skipped, ${report.rejected.length} rejected`);
  }
  console.log(JSON.stringify(totals));
}

try {
  if (values.help || !command) console.log(HELP);
  else if (command === 'coverage') coverage();
  else if (command === 'gaps') gaps();
  else if (command === 'apply') apply();
  else if (command === 'enrich') await enrich();
  else throw new Error(`Unknown command ${command}\n${HELP}`);
} catch (error) {
  // Endpoint URLs and provider errors may contain secrets; print only our own messages.
  console.error(error instanceof Error && !/ENRICH|fetch/i.test(error.stack ?? '') ? error.message : 'Failed. Check ENRICH_BASE_URL / ENRICH_MODEL.');
  process.exitCode = 1;
}
