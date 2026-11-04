import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseIngredient } from '@vegdex/core';
import { crawlAll, type CrawlSource } from './crawl';
import { emitDataset } from './emit';
import { publishStore, pullStore } from './release';
import { loadStore, saveStore } from './store';

const root = path.resolve(import.meta.dirname, '../../..');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    store: { type: 'string', default: path.join(root, '.data/store.json.gz') },
    out: { type: 'string', default: path.join(root, 'apps/web/public/data') },
    sources: { type: 'string' },
    // Small daily batches stay under the rate limits that blogs' firewalls enforce.
    'max-per-source': { type: 'string', default: '400' },
    'gap-ms': { type: 'string', default: '1000' },
    concurrency: { type: 'string', default: '8' },
    'generated-at': { type: 'string' },
    blocklist: { type: 'string' },
    // Start from the store the daily workflow last saved, so a local crawl only fetches what is new.
    pull: { type: 'boolean' },
    // Put the freshly emitted store in the data release and deploy the site from it.
    publish: { type: 'boolean' }
  }
});

const command = positionals[0] ?? 'run';
const allSources = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../sources.json'), 'utf8')) as CrawlSource[];
const only = values.sources?.split(',');
const sources = only ? allSources.filter((s) => only.includes(s.id)) : allSources;
const log = (msg: string) => console.log(msg);

if (values.pull) {
  log('Downloading the crawl store from the data release…');
  pullStore(values.store!);
}

/** Hand a locally emitted store to the daily workflow, which rebuilds and deploys from it. */
function publish() {
  log('Uploading the crawl store to the data release and queuing the deploy…');
  try {
    publishStore(values.store!);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  log('Deploy queued; watch it with: gh run list --workflow=daily.yml --limit 1');
}

async function crawl() {
  const store = loadStore(values.store!);
  const before = Object.keys(store.recipes).length;
  // Save on Ctrl-C so a long backfill is not lost.
  process.once('SIGINT', () => {
    saveStore(values.store!, store);
    process.exit(130);
  });
  const timer = setInterval(() => saveStore(values.store!, store), 60_000);
  const results = await crawlAll(sources, store, {
    maxPerSource: Number(values['max-per-source']),
    gapMs: Number(values['gap-ms']),
    concurrency: Number(values.concurrency),
    log
  });
  clearInterval(timer);
  saveStore(values.store!, store);
  const after = Object.keys(store.recipes).length;
  log(`\nstore: ${after} recipes (+${after - before}), ${Object.keys(store.urls).length} urls tracked`);
  // The per-source report answers "how is the crawl?" without digging through the workflow log.
  fs.writeFileSync(path.join(path.dirname(values.store!), 'crawl-report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), recipes: after, urls: Object.keys(store.urls).length, sources: results
  }, null, 1) + '\n');
  const failing = results.filter((r) => r.recipes === 0 && r.fetched > 0);
  if (failing.length) log(`no recipes from: ${failing.map((r) => `${r.id} (${r.note ?? `${r.errors} errors`})`).join(', ')}`);
}

function emit() {
  const store = loadStore(values.store!);
  fs.mkdirSync(values.out!, { recursive: true });
  const blocklist = values.blocklist ? JSON.parse(fs.readFileSync(values.blocklist, 'utf8')) as string[] : undefined;
  const report = emitDataset(Object.values(store.recipes), allSources, values.out!, { generatedAt: values['generated-at'], blocklist });
  fs.writeFileSync(path.join(path.dirname(values.store!), 'excluded.json'), JSON.stringify(report.excluded, null, 1));
  fs.writeFileSync(path.join(path.dirname(values.store!), 'held.json'), JSON.stringify(report.held.map(({ id, title, url }) => ({ id, title, url })), null, 1));
  const blocked = report.excluded.filter((r) => r.reason === 'blocklist').length;
  log(`published ${report.published} recipes (${(report.bytes / 1e6).toFixed(1)} MB raw), excluded ${report.excluded.length - blocked} by the vegan check, ${blocked} by the blocklist and ${report.otherLanguage} translated editions`);
  log(Object.entries(report.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s}: ${n}`).join('\n'));
  // A jump in a source's vegan-check rate means the blog may have stopped being all-vegan (#5).
  const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
  const sourceOf = new Map(allSources.map((s) => [host(s.url), s.id]));
  const flagged = new Map<string, number>();
  for (const r of report.excluded) {
    const id = !r.reason && sourceOf.get(host(r.url));
    if (id) flagged.set(id, (flagged.get(id) ?? 0) + 1);
  }
  for (const [id, n] of flagged) {
    const share = n / (n + (report.bySource[id] ?? 0));
    if (share > 0.1) log(`::warning::${id}: ${Math.round(share * 100)}% of recipes flagged by the vegan check; is it still an all-vegan publisher?`);
  }
}

/**
 * Snapshot the published catalog's cup-measured lines for the weight tests in packages/core:
 * how often each ingredient is measured by volume, and every line where the blog also gave grams.
 */
function weights() {
  const { recipes } = JSON.parse(fs.readFileSync(path.join(values.out!, 'recipes.full.json'), 'utf8')) as { recipes: { ingredients: string[] }[] };
  const names = new Map<string, number>();
  const withGrams = new Set<string>();
  for (const r of recipes)
    for (const line of r.ingredients) {
      const p = parseIngredient(line);
      if (!p.unit || !VOLUME_UNITS.has(p.unit) || p.quantity === null || !p.name) continue;
      if (p.metric?.unit === 'g') withGrams.add(p.raw);
      else names.set(p.name, (names.get(p.name) ?? 0) + 1);
    }
  const file = path.join(root, 'packages/core/test/fixtures/volume-lines.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const snapshot = { names: [...names].sort((a, b) => b[1] - a[1]), withGrams: [...withGrams].sort() };
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 0).replace(/\],\[/g, '],\n[').replace(/","/g, '",\n"') + '\n');
  log(`${names.size} names measured by volume, ${withGrams.size} lines with the blog's own grams → ${path.relative(root, file)}`);
}
const VOLUME_UNITS = new Set(['cup', 'fl oz', 'pint', 'quart']);

if (command === 'crawl') await crawl();
else if (command === 'weights') weights();
else if (command === 'emit') {
  emit();
  if (values.publish) publish();
} else if (command === 'run') {
  await crawl();
  emit();
  if (values.publish) publish();
} else {
  console.error(`unknown command ${command}; use crawl | emit | run | weights`);
  process.exit(1);
}
