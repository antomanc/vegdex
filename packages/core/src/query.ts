import { singularize } from './ingredients';
import { isQualifiedIngredient, lookupConcept, type IngredientLookup } from './concepts';
import type { CatalogRecipe, Flavor, FreeFrom, Meal } from './types';

export interface RecipeQuery {
  text?: string;
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

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .map(singularize);
}

/** True when the phrase's words all occur, in order-independent form, in a name. */
function nameMatches(name: string, phrase: string[]): boolean {
  const words = tokens(name);
  return phrase.every((p) => words.some((w) => w === p || (p.length >= 4 && w.startsWith(p))));
}

interface SearchTerm { words: string[]; concept: string | null }

function searchTerms(text: string, lookup: IngredientLookup): SearchTerm[] {
  if (isQualifiedIngredient(text)) return [{ words: tokens(text), concept: lookupConcept(text, lookup) }];
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
    terms.push({ words: tokens(words.slice(start, end).join(' ')), concept });
    start = end;
  }
  return terms;
}

/** Concepts add matches (Italian names, synonyms); the English text match always still counts. */
function hasIngredient(recipe: CatalogRecipe, term: SearchTerm): boolean {
  if (term.concept && recipe.concepts?.includes(term.concept)) return true;
  return recipe.ing.some((name) => nameMatches(name, term.words));
}

/** Bayesian-ish rating so 5.0 from 2 votes does not beat 4.8 from 300. */
export function ratingScore(r: Pick<CatalogRecipe, 'rating' | 'ratingCount'>): number {
  const n = r.ratingCount ?? 0;
  const avg = r.rating ?? 0;
  return (avg * n + 4.2 * 10) / (n + 10);
}

/** A caller can add its guarded display title without replacing the original catalog text. */
export function searchRecipes<R extends CatalogRecipe>(recipes: R[], q: RecipeQuery, lookup: IngredientLookup = {}, displayTitle?: (recipe: R) => string): R[] {
  const textTerms = q.text ? searchTerms(q.text, lookup).filter((t) => t.words.length) : [];
  const include = (q.include ?? []).filter((p) => tokens(p).length).map((p) => ({ words: tokens(p), concept: lookupConcept(p, lookup) }));
  const exclude = (q.exclude ?? []).filter((p) => tokens(p).length).map((p) => ({ words: tokens(p), concept: lookupConcept(p, lookup) }));
  const ids = q.ids ? new Set(q.ids) : null;
  const sources = q.sources?.length ? new Set(q.sources) : null;
  const cuisine = q.cuisine?.toLowerCase();

  const scored: { r: R; score: number }[] = [];
  for (const r of recipes) {
    if (ids && !ids.has(r.id)) continue;
    if (sources && !sources.has(r.source)) continue;
    if (q.meals?.length && !q.meals.some((m) => r.tags.includes(`meal:${m}`))) continue;
    if (q.flavor && !r.tags.includes(`flavor:${q.flavor}`)) continue;
    if (q.maxMinutes !== undefined && (r.minutes === null || r.minutes > q.maxMinutes)) continue;
    if (q.freeFrom?.length && !q.freeFrom.every((f) => r.tags.includes(`free:${f}`))) continue;
    if (q.highProtein && !r.tags.includes('high-protein')) continue;
    if (cuisine && !r.tags.some((t) => t.startsWith('cuisine:') && t.includes(cuisine))) continue;
    if (q.minRating !== undefined && (r.rating ?? 0) < q.minRating) continue;
    if (!include.every((p) => hasIngredient(r, p))) continue;
    if (exclude.some((p) => hasIngredient(r, p))) continue;

    let score = 0;
    if (textTerms.length) {
      const title = tokens(`${r.title} ${displayTitle?.(r) ?? ''}`);
      let matched = 0;
      for (const term of textTerms) for (const t of term.words) {
        if (title.some((w) => w === t)) score += 3;
        else if (title.some((w) => t.length >= 3 && w.startsWith(t))) score += 2;
        else if (hasIngredient(r, { words: [t], concept: term.concept })) score += 1;
        else continue;
        matched++;
      }
      if (matched < textTerms.reduce((n, term) => n + term.words.length, 0)) continue;
    }
    scored.push({ r, score });
  }

  const sort = q.sort ?? (textTerms.length ? 'relevance' : 'rating');
  const cmp: Record<NonNullable<RecipeQuery['sort']>, (a: { r: R; score: number }, b: { r: R; score: number }) => number> = {
    relevance: (a, b) => b.score - a.score || ratingScore(b.r) - ratingScore(a.r),
    rating: (a, b) => ratingScore(b.r) - ratingScore(a.r),
    newest: (a, b) => (b.r.published ?? '').localeCompare(a.r.published ?? ''),
    fastest: (a, b) => (a.r.minutes ?? Infinity) - (b.r.minutes ?? Infinity)
  };
  return scored.sort(cmp[sort]).map((s) => s.r);
}
