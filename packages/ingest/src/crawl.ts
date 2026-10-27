import type { Source } from '@vegdex/core';
import { extractRecipe } from './extract';
import { fetchText, HostQueue } from './http';
import { parseRobots, type Robots } from './robots';
import { isCandidateUrl, isContentSitemap, parseSitemap, type SitemapEntry } from './sitemap';
import type { Store } from './store';

export interface CrawlSource extends Source {
  /** Only URLs whose path matches this regex are candidates. */
  include?: string;
}

export interface CrawlOptions {
  /** Cap new page fetches per source in one run (backfills spread over several runs). */
  maxPerSource: number;
  /** Minimum gap between requests to one host. */
  gapMs: number;
  /** How many sources crawl at the same time. */
  concurrency: number;
  log: (msg: string) => void;
}

export interface SourceResult {
  id: string;
  candidates: number;
  fetched: number;
  recipes: number;
  errors: number;
  note?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

async function discover(source: CrawlSource, robots: Robots, queue: HostQueue): Promise<SitemapEntry[]> {
  const roots = robots.sitemaps.length
    ? robots.sitemaps
    : ['/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap.xml'].map((p) => source.url + p);
  const seen = new Set<string>();
  const entries = new Map<string, SitemapEntry>();
  const todo = [...new Set(roots)];
  while (todo.length && seen.size < 60) {
    const url = todo.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await queue.run(() => fetchText(url)).catch(() => null);
    if (!res || res.status !== 200) continue;
    const parsed = parseSitemap(res.text);
    for (const child of parsed.sitemaps) if (isContentSitemap(child)) todo.push(child);
    for (const e of parsed.urls) if (!/\.(?:jpe?g|png|webp|gif|pdf)$/i.test(e.url)) entries.set(e.url, e);
    // A root that is an index already gave us everything; stop trying fallbacks.
    if (parsed.sitemaps.length && !robots.sitemaps.length) todo.splice(0, todo.length, ...parsed.sitemaps.filter(isContentSitemap).filter((s) => !seen.has(s)));
  }
  const include = source.include ? new RegExp(source.include) : null;
  return [...entries.values()].filter(
    (e) => isCandidateUrl(e.url, source.url) && (!include || include.test(new URL(e.url).pathname))
  );
}

/** Is this URL worth (re)fetching today? */
function needsFetch(store: Store, e: SitemapEntry): boolean {
  const st = store.urls[e.url];
  if (!st) return true;
  if (st.s === 'e') return (st.err ?? 0) < 3;
  if (st.s === 'b') return false;
  // Re-fetch when the publisher says the page changed.
  return Boolean(e.lastmod && st.lm && e.lastmod > st.lm);
}

export async function crawlSource(source: CrawlSource, store: Store, opts: CrawlOptions): Promise<SourceResult> {
  const result: SourceResult = { id: source.id, candidates: 0, fetched: 0, recipes: 0, errors: 0 };
  const robotsRes = await fetchText(source.url + '/robots.txt').catch(() => null);
  const robots = parseRobots(robotsRes?.status === 200 ? robotsRes.text : '');
  const gap = Math.max(opts.gapMs, Math.min((robots.crawlDelay ?? 0) * 1000, 10_000));
  const queue = new HostQueue(gap);

  const entries = await discover(source, robots, queue);
  result.candidates = entries.length;
  if (!entries.length) {
    result.note = 'no sitemap entries found';
    return result;
  }

  // Newest first, so a capped backfill starts with fresh content.
  const todo = entries
    .filter((e) => needsFetch(store, e))
    .sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? ''))
    .slice(0, opts.maxPerSource);

  for (const e of todo) {
    if (!robots.allowed(e.url)) {
      store.urls[e.url] = { s: 'b', lm: e.lastmod, at: today() };
      continue;
    }
    result.fetched++;
    try {
      const res = await queue.run(() => fetchText(e.url));
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const recipe = extractRecipe(res.text, res.url || e.url, source.id);
      if (recipe) {
        // Drop an older copy stored under a different id (URL changed via redirect).
        const prev = store.urls[e.url]?.id;
        if (prev && prev !== recipe.id) delete store.recipes[prev];
        store.recipes[recipe.id] = recipe;
        store.urls[e.url] = { s: 'r', lm: e.lastmod, at: today(), id: recipe.id };
        result.recipes++;
      } else {
        store.urls[e.url] = { s: 'n', lm: e.lastmod, at: today() };
      }
    } catch (err) {
      const prev = store.urls[e.url];
      store.urls[e.url] = { ...prev, s: prev?.s === 'r' ? 'r' : 'e', lm: prev?.lm ?? null, at: today(), err: (prev?.err ?? 0) + 1 };
      result.errors++;
      if (result.errors >= 20 && result.recipes === 0) {
        result.note = `stopped after ${result.errors} errors: ${(err as Error).message}`;
        break;
      }
    }
    if (result.fetched % 100 === 0) opts.log(`  ${source.id}: ${result.fetched}/${todo.length} fetched, ${result.recipes} recipes`);
  }
  return result;
}

/** Crawl sources with limited parallelism; one host never sees concurrent requests. */
export async function crawlAll(sources: CrawlSource[], store: Store, opts: CrawlOptions): Promise<SourceResult[]> {
  const results: SourceResult[] = [];
  const queue = [...sources];
  const workers = Array.from({ length: Math.min(opts.concurrency, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      opts.log(`→ ${s.id}`);
      const r = await crawlSource(s, store, opts).catch((err: Error) => ({
        id: s.id, candidates: 0, fetched: 0, recipes: 0, errors: 1, note: err.message
      }));
      opts.log(`✓ ${s.id}: ${r.candidates} urls, ${r.fetched} fetched, ${r.recipes} recipes, ${r.errors} errors${r.note ? ` (${r.note})` : ''}`);
      results.push(r);
    }
  });
  await Promise.all(workers);
  return results;
}
