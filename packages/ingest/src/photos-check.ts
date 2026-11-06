/**
 * `pnpm photos:check`: try a few photos of each blog and list the blogs that refuse them. It only reports:
 * a refusal can target this machine alone, so a person sets `photosBlocked` in sources.json after checking.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadStore } from './store';

const SAMPLE = 3;
const root = path.resolve(import.meta.dirname, '../../..');

type Fetch = (url: string) => Promise<{ status: number }>;

/** Blogs whose every sampled photo failed, with the status of the first one. */
export async function refusedPhotos(photos: Map<string, string[]>, get: Fetch): Promise<{ source: string; status: number }[]> {
  const refused: { source: string; status: number }[] = [];
  for (const [source, urls] of photos) {
    const statuses = await Promise.all(urls.slice(0, SAMPLE).map((url) => get(url).then((r) => r.status, () => 0)));
    if (statuses.length && statuses.every((status) => status < 200 || status >= 300)) refused.push({ source, status: statuses[0]! });
  }
  return refused;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { store: { type: 'string', default: path.join(root, '.data/store.json.gz') } } });
  const photos = new Map<string, string[]>();
  for (const recipe of Object.values(loadStore(values.store!).recipes)) {
    if (recipe.image) photos.set(recipe.sourceId, [recipe.image, ...photos.get(recipe.sourceId) ?? []].slice(0, SAMPLE));
  }
  const get: Fetch = (url) => fetch(url, { method: 'GET', headers: { 'user-agent': 'Mozilla/5.0 (compatible; vegdex photo check)' }, signal: AbortSignal.timeout(15_000) });
  const refused = await refusedPhotos(photos, get);
  console.log(`${photos.size} blogs checked, ${refused.length} refuse photos`);
  for (const { source, status } of refused) console.log(`  ${source}: ${status}`);
}
