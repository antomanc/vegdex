import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { crawlAll, type CrawlSource } from './crawl';
import { emitDataset } from './emit';
import { loadStore, saveStore } from './store';

const root = path.resolve(import.meta.dirname, '../../..');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    store: { type: 'string', default: path.join(root, '.data/store.json.gz') },
    out: { type: 'string', default: path.join(root, 'apps/web/public/data') },
    sources: { type: 'string' },
    'max-per-source': { type: 'string', default: '100000' },
    'gap-ms': { type: 'string', default: '1000' },
    concurrency: { type: 'string', default: '8' }
  }
});

const command = positionals[0] ?? 'run';
const allSources = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../sources.json'), 'utf8')) as CrawlSource[];
const only = values.sources?.split(',');
const sources = only ? allSources.filter((s) => only.includes(s.id)) : allSources;
const log = (msg: string) => console.log(msg);

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
  const failing = results.filter((r) => r.recipes === 0 && r.fetched > 0);
  if (failing.length) log(`no recipes from: ${failing.map((r) => `${r.id} (${r.note ?? `${r.errors} errors`})`).join(', ')}`);
}

function emit() {
  const store = loadStore(values.store!);
  fs.mkdirSync(values.out!, { recursive: true });
  const report = emitDataset(Object.values(store.recipes), allSources, values.out!);
  fs.writeFileSync(path.join(path.dirname(values.store!), 'excluded.json'), JSON.stringify(report.excluded, null, 1));
  log(`published ${report.published} recipes (${(report.bytes / 1e6).toFixed(1)} MB raw), excluded ${report.excluded.length} by the vegan check`);
  log(Object.entries(report.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s}: ${n}`).join('\n'));
}

if (command === 'crawl') await crawl();
else if (command === 'emit') emit();
else if (command === 'run') {
  await crawl();
  emit();
} else {
  console.error(`unknown command ${command}; use crawl | emit | run`);
  process.exit(1);
}
