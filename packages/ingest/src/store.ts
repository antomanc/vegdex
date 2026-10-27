import type { Recipe } from '@vegdex/core';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/** r = recipe, n = not a recipe, e = fetch error, b = blocked by robots */
export type UrlStatus = 'r' | 'n' | 'e' | 'b';

export interface UrlState {
  s: UrlStatus;
  /** Sitemap lastmod seen when fetched. */
  lm: string | null;
  /** Date checked (YYYY-MM-DD). */
  at: string;
  /** Consecutive errors. */
  err?: number;
  id?: string;
}

/** Everything the pipeline remembers between runs. Persisted as one gzip JSON file. */
export interface Store {
  version: 1;
  urls: Record<string, UrlState>;
  /** Every extracted recipe, vegan-checked or not: the check runs at emit time so it can be tuned. */
  recipes: Record<string, Recipe>;
}

export function loadStore(file: string): Store {
  if (!fs.existsSync(file)) return { version: 1, urls: {}, recipes: {} };
  const raw = fs.readFileSync(file);
  const json = file.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  return JSON.parse(json) as Store;
}

export function saveStore(file: string, store: Store): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(store);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, file.endsWith('.gz') ? gzipSync(json) : json);
  fs.renameSync(tmp, file);
}
