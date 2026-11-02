import { singularize } from './ingredients';
import { isQualifiedIngredient, lookupConcept, type IngredientLookup } from './concepts';
import type { CatalogRecipe, Flavor, FreeFrom, Meal } from './types';

export interface RecipeQuery {
  text?: string;
  /** Restrict recipes to the language their source writes in. */
  contentLanguage?: string;
  /** Prefer this content language only when the selected ordering ties. */
  preferredContentLanguage?: string;
  meals?: Meal[];
  flavor?: Flavor;
  maxMinutes?: number;
  freeFrom?: FreeFrom[];
  highProtein?: boolean;
  /** Every one of these must appear among the ingredients. */
  include?: string[];
  /** None of these may appear among the ingredients. */
  exclude?: string[];
  sources?: string[];
  cuisine?: string;
  minRating?: number;
  ids?: string[];
  sort?: 'relevance' | 'rating' | 'newest' | 'fastest';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .map(singularize);
}

// Titles and ingredient names repeat across searches and recipes ("garlic"), so each is tokenized once.
const tokenCache = new Map<string, string[]>();
function tokens(text: string): string[] {
  let cached = tokenCache.get(text);
  if (!cached) tokenCache.set(text, (cached = tokenize(text)));
  return cached;
}

const wordMatches = (words: string[], p: string) => words.some((w) => w === p || (p.length >= 4 && w.startsWith(p)));

/** What filtering and ranking read from a recipe, worked out once per recipe instead of on every keystroke. */
interface RecipeIndex {
  score: number;
  /** Built on first use: the plain best-rated list needs none of these. */
  tags?: Set<string>;
  concepts?: Set<string>;
  text?: { title: string; words: string; names: string[][] };
}
const indexes = new WeakMap<CatalogRecipe, RecipeIndex>();
function indexOf(r: CatalogRecipe): RecipeIndex {
  let index = indexes.get(r);
  if (!index) indexes.set(r, (index = { score: ratingScore(r) }));
  return index;
}
const tagsOf = (r: CatalogRecipe, index: RecipeIndex) => (index.tags ??= new Set(r.tags));
const conceptsOf = (r: CatalogRecipe, index: RecipeIndex) => (index.concepts ??= new Set(r.concepts));

/** Title and ingredient words padded with spaces (" chickpea curry "), so one word is one native search. */
function textOf(r: CatalogRecipe, index: RecipeIndex): NonNullable<RecipeIndex['text']> {
  if (!index.text) {
    const names = r.ing.map(tokens);
    index.text = { title: padded(tokens(r.title)), words: padded(names.flat()), names };
  }
  return index.text;
}

/** Sorted distinct words, each with the positions of the recipes that use it. */
interface WordIndex { words: string[]; posts: Map<string, number[]> }

/** Collects positions word by word; positions arrive in increasing order, so a repeat is the last one added. */
function wordIndexBuilder() {
  const posts = new Map<string, number[]>();
  return {
    add(at: number, words: Iterable<string>) {
      for (const w of words) {
        const list = posts.get(w);
        if (!list) posts.set(w, [at]);
        else if (list[list.length - 1] !== at) list.push(at);
      }
    },
    finish: (): WordIndex => ({ words: [...posts.keys()].sort(), posts })
  };
}

function wordIndex<R>(order: R[], wordsOf: (r: R) => Iterable<string>): WordIndex {
  const builder = wordIndexBuilder();
  order.forEach((r, at) => builder.add(at, wordsOf(r)));
  return builder.finish();
}

/** The posting lists of a word, or of every word that starts with it. */
function postings(index: WordIndex, word: string, prefix: boolean): number[][] {
  if (!prefix) return index.posts.has(word) ? [index.posts.get(word)!] : [];
  let lo = 0;
  let hi = index.words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index.words[mid]! < word) lo = mid + 1;
    else hi = mid;
  }
  const lists: number[][] = [];
  for (let k = lo; k < index.words.length && index.words[k]!.startsWith(word); k++) lists.push(index.posts.get(index.words[k]!)!);
  return lists;
}

type Words = { title: WordIndex; ingredients: WordIndex; concepts: WordIndex };

/**
 * One recipe list prepared for search: walked best-rated first, so the sort that follows mostly confirms
 * the order it is given, and word indexes that narrow a search to the recipes that can match it.
 */
interface Prepared<R> {
  order: R[];
  /** Rating scores, by position in `order`. */
  scores: Float64Array;
  /** The full ranking per preferred language: rating, then recipes in that language first on ties. */
  ranked: Map<string, { order: R[]; rank: Int32Array }>;
  words?: Words;
  /** Display titles, per title function: a new function means new titles. */
  shown: WeakMap<object, WordIndex>;
  /** prepareSearch is building the indexes in idle time; until it is done, a search scans instead of waiting. */
  warming?: boolean;
}
const prepared = new WeakMap<readonly CatalogRecipe[], Prepared<CatalogRecipe>>();
function prepare<R extends CatalogRecipe>(recipes: R[]): Prepared<R> {
  let p = prepared.get(recipes) as Prepared<R> | undefined;
  if (!p) {
    const scores = recipes.map((r) => indexOf(r).score);
    const positions = recipes.map((_, at) => at).sort((a, b) => scores[b]! - scores[a]! || a - b);
    p = { order: positions.map((at) => recipes[at]!), scores: Float64Array.from(positions, (at) => scores[at]!), ranked: new Map(), shown: new WeakMap() };
    prepared.set(recipes, p as Prepared<CatalogRecipe>);
  }
  return p;
}
function rankedBy<R extends CatalogRecipe>(p: Prepared<R>, preferred = ''): { order: R[]; rank: Int32Array } {
  let ranked = p.ranked.get(preferred);
  if (!ranked) {
    const first = Uint8Array.from(p.order, (r) => Number((r.contentLanguage ?? 'en') === preferred));
    const positions = p.order.map((_, at) => at).sort((a, b) => p.scores[b]! - p.scores[a]! || first[b]! - first[a]! || a - b);
    const rank = new Int32Array(positions.length);
    positions.forEach((at, k) => (rank[at] = k));
    p.ranked.set(preferred, (ranked = { order: positions.map((at) => p.order[at]!), rank }));
  }
  return ranked;
}

/** Indexes the recipes at positions [from, to) of `order`; call with increasing ranges. */
function wordsBuilder<R extends CatalogRecipe>(p: Prepared<R>) {
  const title = wordIndexBuilder();
  const ingredients = wordIndexBuilder();
  const concepts = wordIndexBuilder();
  return {
    add(from: number, to: number) {
      for (let at = from; at < to; at++) {
        const r = p.order[at]!;
        const text = textOf(r, indexOf(r));
        title.add(at, tokens(r.title));
        for (const name of text.names) ingredients.add(at, name);
        concepts.add(at, r.concepts ?? []);
      }
    },
    finish: (): Words => ({ title: title.finish(), ingredients: ingredients.finish(), concepts: concepts.finish() })
  };
}
function wordsOf<R extends CatalogRecipe>(p: Prepared<R>): Words {
  if (!p.words) {
    const builder = wordsBuilder(p);
    builder.add(0, p.order.length);
    p.words = builder.finish();
  }
  return p.words;
}

/**
 * Positions that meet every requirement, in order; a requirement is met by a position in any of its lists.
 * The lists only narrow the search: each candidate is still checked in full.
 */
function candidates(size: number, requirements: number[][][]): number[] {
  const hits = new Uint8Array(size);
  const seen = new Int32Array(size).fill(-1);
  requirements.forEach((lists, k) => {
    for (const list of lists) for (const at of list) if (seen[at] !== k) {
      seen[at] = k;
      hits[at]!++;
    }
  });
  const found: number[] = [];
  for (let at = 0; at < size; at++) if (hits[at] === requirements.length) found.push(at);
  return found;
}

/**
 * Tokenize every recipe and build the word indexes ahead of the first search, a slice at a time so the
 * page stays responsive. Searching works without it; this only takes the cost off the first keystroke.
 */
export function prepareSearch(recipes: CatalogRecipe[], schedule: (next: () => void) => void = (next) => setTimeout(next)): void {
  const p = prepare(recipes);
  if (p.words || p.warming) return;
  p.warming = true;
  const builder = wordsBuilder(p);
  let at = 0;
  const step = () => {
    const to = Math.min(at + 400, p.order.length);
    builder.add(at, to);
    at = to;
    if (at < p.order.length) return schedule(step);
    schedule(() => {
      p.words = builder.finish();
      p.warming = false;
    });
  };
  schedule(step);
}

const padded = (words: string[]) => ` ${words.join(' ')} `;
/** A search word with its padded forms built once per query, not once per recipe. */
interface Needle { word: string; whole: string; start: string }
const needle = (word: string): Needle => ({ word, whole: ` ${word} `, start: ` ${word}` });

interface SearchTerm { words: string[]; needles: Needle[]; concept: string | null }
const term = (words: string[], concept: string | null): SearchTerm => ({ words, needles: words.map(needle), concept });

function searchTerms(text: string, lookup: IngredientLookup): SearchTerm[] {
  if (isQualifiedIngredient(text)) return [term(tokenize(text), lookupConcept(text, lookup))];
  const words = text.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) ?? [];
  const terms: SearchTerm[] = [];
  for (let start = 0; start < words.length;) {
    let end = words.length;
    let concept: string | null = null;
    for (; end > start; end--) {
      concept = lookupConcept(words.slice(start, end).join(' '), lookup);
      if (concept) break;
    }
    if (!concept) end = start + 1;
    terms.push(term(tokenize(words.slice(start, end).join(' ')), concept));
    start = end;
  }
  return terms;
}

/** Concepts add matches (Italian names, synonyms); the English text match always still counts. */
function hasIngredient(r: CatalogRecipe, index: RecipeIndex, { words, needles, concept }: SearchTerm): boolean {
  if (concept && conceptsOf(r, index).has(concept)) return true;
  const text = textOf(r, index);
  if (needles.length === 1) {
    const [n] = needles as [Needle];
    return text.words.includes(n.word.length >= 4 ? n.start : n.whole);
  }
  // The phrase's words all occur, in order-independent form, in one name.
  return text.names.some((name) => words.every((p) => wordMatches(name, p)));
}

/** Bayesian-ish rating so 5.0 from 2 votes does not beat 4.8 from 300. */
export function ratingScore(r: Pick<CatalogRecipe, 'rating' | 'ratingCount'>): number {
  const n = r.ratingCount ?? 0;
  const avg = r.rating ?? 0;
  return (avg * n + 4.2 * 10) / (n + 10);
}

/**
 * A caller can add its guarded display title without replacing the original catalog text.
 * Indexes are kept per `recipes` array and per `displayTitle` function: pass a new array when recipes
 * change and a new function when the titles it returns change.
 */
export function searchRecipes<R extends CatalogRecipe>(recipes: R[], q: RecipeQuery, lookup: IngredientLookup = {}, displayTitle?: (recipe: R) => string): R[] {
  const textTerms = q.text ? searchTerms(q.text, lookup).filter((t) => t.words.length) : [];
  const include = (q.include ?? []).filter((p) => tokenize(p).length).map((p) => term(tokenize(p), lookupConcept(p, lookup)));
  const exclude = (q.exclude ?? []).filter((p) => tokenize(p).length).map((p) => term(tokenize(p), lookupConcept(p, lookup)));
  // Each searched word on its own, with its term's concept: an ingredient match scores the word.
  const singles = textTerms.flatMap((t) => t.needles.map((n) => ({ n, alone: { words: [n.word], needles: [n], concept: t.concept } })));
  const ids = q.ids ? new Set(q.ids) : null;
  const sources = q.sources?.length ? new Set(q.sources) : null;
  const cuisine = q.cuisine?.toLowerCase();

  const meals = q.meals?.map((m) => `meal:${m}`);
  const freeFrom = q.freeFrom?.map((f) => `free:${f}`);
  const wanted = textTerms.reduce((n, term) => n + term.words.length, 0);

  // Text and wanted ingredients narrow the walk to the recipes whose words can match; the checks below decide.
  const p = prepare(recipes);
  const ranked = rankedBy(p, q.preferredContentLanguage);
  let walk = ranked.order;
  if ((singles.length || include.length) && !p.warming) {
    const words = wordsOf(p);
    let shownWords: WordIndex | undefined;
    if (displayTitle && singles.length) {
      shownWords = p.shown.get(displayTitle);
      if (!shownWords) {
        shownWords = wordIndex(p.order, (r) => {
          const shown = displayTitle(r);
          return shown !== r.title ? tokens(shown) : [];
        });
        p.shown.set(displayTitle, shownWords);
      }
    }
    const ingredient = (word: string) => postings(words.ingredients, word, word.length >= 4);
    const concept = (id: string | null) => (id ? postings(words.concepts, id, false) : []);
    const requirements = [
      ...singles.map(({ n, alone }) => [
        ...postings(words.title, n.word, n.word.length >= 3),
        ...(shownWords ? postings(shownWords, n.word, n.word.length >= 3) : []),
        ...ingredient(n.word),
        ...concept(alone.concept)
      ]),
      // A phrase must sit in one name; its first word is enough to narrow.
      ...include.map((t) => [...ingredient(t.words[0]!), ...concept(t.concept)])
    ];
    walk = candidates(p.order.length, requirements).sort((a, b) => ranked.rank[a]! - ranked.rank[b]!).map((at) => p.order[at]!);
  }

  const scored: { r: R; score: number }[] = [];
  for (const r of walk) {
    if (ids && !ids.has(r.id)) continue;
    if (q.contentLanguage && (r.contentLanguage ?? 'en') !== q.contentLanguage) continue;
    if (sources && !sources.has(r.source)) continue;
    if (q.maxMinutes !== undefined && (r.minutes === null || r.minutes > q.maxMinutes)) continue;
    if (q.minRating !== undefined && (r.rating ?? 0) < q.minRating) continue;
    const index = indexOf(r);
    if (meals?.length && !meals.some((m) => tagsOf(r, index).has(m))) continue;
    if (q.flavor && !tagsOf(r, index).has(`flavor:${q.flavor}`)) continue;
    if (freeFrom?.length && !freeFrom.every((f) => tagsOf(r, index).has(f))) continue;
    if (q.highProtein && !tagsOf(r, index).has('high-protein')) continue;
    if (cuisine && !r.tags.some((t) => t.startsWith('cuisine:') && t.includes(cuisine))) continue;
    if (!include.every((p) => hasIngredient(r, index, p))) continue;
    if (exclude.some((p) => hasIngredient(r, index, p))) continue;

    let score = 0;
    if (textTerms.length) {
      const shown = displayTitle?.(r);
      const own = textOf(r, index).title;
      const title = shown && shown !== r.title ? `${own}${padded(tokens(shown))}` : own;
      let matched = 0;
      for (const { n, alone } of singles) {
        if (title.includes(n.whole)) score += 3;
        else if (n.word.length >= 3 && title.includes(n.start)) score += 2;
        else if (hasIngredient(r, index, alone)) score += 1;
        else continue;
        matched++;
      }
      if (matched < wanted) continue;
    }
    scored.push({ r, score });
  }

  // The walk is already in rating order with the preferred language first on ties; sorts are stable,
  // so every other order falls back to it.
  const sort = q.sort ?? (textTerms.length ? 'relevance' : 'rating');
  type Scored = (typeof scored)[number];
  const cmp: Record<Exclude<NonNullable<RecipeQuery['sort']>, 'rating'>, (a: Scored, b: Scored) => number> = {
    relevance: (a, b) => b.score - a.score,
    newest: (a, b) => (b.r.published ?? '').localeCompare(a.r.published ?? ''),
    fastest: (a, b) => (a.r.minutes ?? Infinity) - (b.r.minutes ?? Infinity)
  };
  if (sort !== 'rating') scored.sort(cmp[sort]);
  return scored.map((s) => s.r);
}
