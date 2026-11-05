import type { CatalogRecipe } from './types';
import { ratingScore } from './query';

/** Ratings worth leading with: pictured recipes that enough cooks have rated well. */
const POOL_SCORE = 4.6;
const POOL_VOTES = 10;
/** At most this many recipes from one blog in any run of this many cards. */
const SOURCE_CAP = 2;
const SOURCE_WINDOW = 12;
/** Savoury cards lead three slots of every four on the default screen. */
const SAVOURY_SLOTS = 4;

/**
 * The day (YYYY-MM-DD, UTC) whose emit seeds Today's picks. A catalog's `generatedAt` gives the same
 * day to catalog.json and first.json, so the order changes with the daily emit, not with the device.
 */
export function picksSeed(generatedAt: string): string {
  const at = Date.parse(generatedAt);
  return Number.isNaN(at) ? generatedAt.slice(0, 10) : new Date(at).toISOString().slice(0, 10);
}

/** FNV-1a over the seed and id, mixed once more: a stable pseudo-random key, never Math.random. */
function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Pictured, well rated and rated often enough to lead: the pool Today's picks shuffles. */
function inPool(r: CatalogRecipe): boolean {
  return !!r.image && (r.ratingCount ?? 0) >= POOL_VOTES && ratingScore(r) >= POOL_SCORE;
}

/**
 * Today's picks in their browsing order, before filters: a seeded shuffle of the strong, pictured recipes,
 * then everything else in rating order so no recipe is left out. Deterministic for one seed and recipe set.
 */
export function picksOrder<R extends CatalogRecipe>(recipes: readonly R[], seed: string): R[] {
  const pool: R[] = [];
  const rest: R[] = [];
  for (const r of recipes) (inPool(r) ? pool : rest).push(r);
  const shuffled = pool
    .map((r, at) => ({ r, at, key: hash(`${seed}\u0000${r.id}`) }))
    .sort((a, b) => a.key - b.key || a.at - b.at)
    .map(({ r }) => r);
  const rated = rest
    .map((r, at) => ({ r, at, score: ratingScore(r) }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .map(({ r }) => r);
  return [...shuffled, ...rated];
}

export interface MixOptions {
  /** Default screen only: three cards of every four are savoury. */
  savouryLead?: boolean;
}

const savoury = (r: CatalogRecipe) => r.tags.includes('flavor:savory');

/**
 * Arrange a filtered list (already in Today's picks order) for the grid: no blog fills a screen — at most
 * {@link SOURCE_CAP} recipes from one source in any {@link SOURCE_WINDOW} consecutive cards — and, on the
 * default screen, savoury leads three cards of every four. Blogs with more cards still to place go first,
 * so one cannot pile up at the tail; otherwise the earliest card in picks order wins, so the daily order
 * survives where the cap allows. A cap that cannot be met is relaxed per card rather than dropping
 * recipes; a list from one blog has no cap to meet.
 */
export function mixPicks<R extends CatalogRecipe>(recipes: R[], { savouryLead = false }: MixOptions = {}): R[] {
  const sourceAt = new Map<string, number>();
  const queues: number[][] = [];
  recipes.forEach((r, at) => {
    let source = sourceAt.get(r.source);
    if (source === undefined) {
      source = queues.length;
      sourceAt.set(r.source, source);
      queues.push([]);
    }
    queues[source]!.push(at);
  });
  // One blog has no mix to correct.
  const cap = queues.length > 1 ? SOURCE_CAP : Infinity;
  if (cap === Infinity && !savouryLead) return [...recipes];

  const sources = queues.length;
  const cursor = new Int32Array(sources);
  const left = Int32Array.from(queues, (queue) => queue.length);
  const inWindow = new Int32Array(sources);
  const isSavoury = Uint8Array.from(recipes, (r) => Number(savoury(r)));
  // The sources of the last SOURCE_WINDOW - 1 cards: with the card being placed, that is one window.
  const recent = new Int32Array(SOURCE_WINDOW);
  let recentAt = 0;
  let windowSize = 0;
  const out: R[] = [];

  /** The pending card that is most behind, matches `want` (any when -1) and does not overfill `limit`. */
  const choose = (want: number, limit: number): number => {
    let best = -1;
    let mostLeft = -1;
    for (let source = 0; source < sources; source++) {
      if (inWindow[source]! >= limit) continue;
      const at = cursor[source]!;
      const queue = queues[source]!;
      if (at >= queue.length) continue;
      const candidate = queue[at]!;
      if (want >= 0 && isSavoury[candidate] !== want) continue;
      // Blogs with more cards still to place go first, so one cannot pile up at the tail; within a blog,
      // the earliest card in picks order wins, so the daily order survives where the cap allows.
      const remaining = left[source]!;
      if (remaining > mostLeft || (remaining === mostLeft && candidate < best)) {
        best = candidate;
        mostLeft = remaining;
      }
    }
    return best;
  };

  for (let slot = 0; slot < recipes.length; slot++) {
    // The fourth slot takes a sweet card when one is left; savoury leads the other three.
    const want = savouryLead ? (slot % SAVOURY_SLOTS !== SAVOURY_SLOTS - 1 ? 1 : 0) : -1;
    let at = choose(want, cap);
    // Savoury ran out under the cap: keep the mix before forcing a card the cap blocks.
    if (at < 0 && want >= 0) at = choose(-1, cap);
    if (at < 0 && want >= 0) at = choose(want, Infinity);
    if (at < 0) at = choose(-1, Infinity);
    const pick = recipes[at]!;
    const source = sourceAt.get(pick.source)!;
    out.push(pick);
    cursor[source]! += 1;
    left[source]! -= 1;
    inWindow[source]! += 1;
    recent[recentAt] = source;
    recentAt = (recentAt + 1) % SOURCE_WINDOW;
    if (windowSize < SOURCE_WINDOW) windowSize++;
    // The oldest card leaves the window once SOURCE_WINDOW - 1 cards sit behind the next one.
    if (windowSize >= SOURCE_WINDOW) inWindow[recent[recentAt]!]! -= 1;
  }
  return out;
}
