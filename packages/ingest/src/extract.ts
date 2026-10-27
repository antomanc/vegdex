import { cleanText, type Recipe } from '@vegdex/core';
import { createHash } from 'node:crypto';

type Json = Record<string, any>;

function isRecipe(node: unknown): node is Json {
  if (!node || typeof node !== 'object') return false;
  const type = (node as Json)['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

/** Walk JSON-LD (plain, arrays, @graph, nested mainEntity) and collect Recipe nodes. */
function collectRecipes(value: unknown, out: Json[] = [], depth = 0): Json[] {
  if (depth > 6 || !value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const v of value) collectRecipes(v, out, depth + 1);
    return out;
  }
  if (isRecipe(value)) out.push(value);
  const obj = value as Json;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'hasPart', 'itemListElement', 'item'])
    if (obj[key] && typeof obj[key] === 'object') collectRecipes(obj[key], out, depth + 1);
  return out;
}

export function recipeNodes(html: string): Json[] {
  const nodes: Json[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectRecipes(JSON.parse(m[1]!.trim()), nodes);
    } catch {
      // Malformed blocks are common; skip them.
    }
  }
  return nodes;
}

const strings = (v: unknown): string[] => {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (typeof v === 'object') return strings((v as Json).name ?? (v as Json)['@id']);
  return String(v)
    .split(/\s*,\s*/)
    .map(cleanText)
    .filter(Boolean);
};

/** ISO 8601 duration (PT1H30M, P0DT2H) → minutes. */
export function durationMinutes(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60;
  return mins > 0 ? Math.round(mins) : null;
}

const firstNumber = (v: unknown): number | null => {
  for (const s of strings(v)) {
    const n = Number(s.match(/\d+(?:\.\d+)?/)?.[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

/** Prefer a ~square, mid-sized variant so the grid does not load 3000px hero images. */
export function pickImage(v: unknown): string | null {
  const urls = (Array.isArray(v) ? v : [v])
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? (x as Json).url ?? (x as Json)['@id'] : null))
    .filter((x): x is string => typeof x === 'string' && /^https?:\/\//.test(x));
  if (urls.length === 0) return null;
  const sized = urls
    .map((url) => {
      const m = url.match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp)/i);
      return m ? { url, w: Number(m[1]), h: Number(m[2]) } : null;
    })
    .filter((x): x is { url: string; w: number; h: number } => x !== null);
  const square = sized.find((s) => s.w === s.h && s.w >= 300 && s.w <= 800);
  return square?.url ?? sized.find((s) => s.w >= 400 && s.w <= 900)?.url ?? urls[0]!;
}

function isoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v.replace(/\b(a|p)\.m\./i, '$1m').replace(/\./g, ''));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export const recipeId = (url: string) => createHash('sha1').update(url).digest('base64url').slice(0, 10);

/** The page's first Recipe as plain facts, or null when there is none. Tags and the vegan check run at emit time. */

export function extractRecipe(html: string, pageUrl: string, sourceId: string): Recipe | null {
  const node = recipeNodes(html)[0];
  if (!node) return null;
  // Not `strings()`: ingredient lines contain commas that must survive.
  const rawIngredients: unknown = node.recipeIngredient ?? node.ingredients ?? [];
  const ingredients = (Array.isArray(rawIngredients) ? rawIngredients : [rawIngredients])
    .filter((line) => typeof line === 'string')
    .map((line) => cleanText(line))
    .filter(Boolean);
  const title = cleanText(String(node.name ?? ''));
  if (!title || ingredients.length < 2) return null;

  const canonical = (() => {
    try {
      const u = new URL(pageUrl);
      u.hash = '';
      u.search = '';
      return u.toString();
    } catch {
      return pageUrl;
    }
  })();

  const prep = durationMinutes(node.prepTime);
  const cook = durationMinutes(node.cookTime);
  const total = durationMinutes(node.totalTime) ?? (prep || cook ? (prep ?? 0) + (cook ?? 0) : null);
  const rating = Number(node.aggregateRating?.ratingValue);
  const ratingCount = Number(node.aggregateRating?.ratingCount ?? node.aggregateRating?.reviewCount);
  const protein = firstNumber(node.nutrition?.proteinContent);
  const categories = strings(node.recipeCategory);
  const cuisines = strings(node.recipeCuisine);
  const keywords = strings(node.keywords);

  return {
    id: recipeId(canonical),
    title,
    sourceId,
    url: canonical,
    image: pickImage(node.image),
    minutes: total,
    servings: firstNumber(node.recipeYield),
    rating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 100) / 100 : null,
    ratingCount: Number.isFinite(ratingCount) && ratingCount > 0 ? ratingCount : null,
    calories: firstNumber(node.nutrition?.calories),
    protein,
    published: isoDate(node.datePublished),
    categories,
    cuisines,
    keywords,
    ingredients
  };
}
