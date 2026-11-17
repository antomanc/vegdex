import { lookupConcept, type IngredientLookup } from './concepts';
import { aisleFor, type GroceryConcepts } from './grocery';

/**
 * What the concept tree says about a cook's kitchen: which ingredient stands in for which.
 * Built once per catalog from its concepts and their parents (catalog.json ships both).
 */
export interface Kitchen {
  /** Every ancestor of a concept, not the concept itself. */
  ancestors: ReadonlyMap<string, ReadonlySet<string>>;
  /** The direct parents of a concept. */
  parents: ReadonlyMap<string, readonly string[]>;
  /** Concepts made from their parent (almond flour, coconut milk): having the parent is not having these. */
  products: ReadonlySet<string>;
  /** In every kitchen: salt, pepper, water, ice. Never on a missing list. */
  staples: ReadonlySet<string>;
  /**
   * Spices, oils, sauces and baking basics: bought once and kept, so they neither send the cook shopping
   * nor make a fridge. Empty until the shopping-list aisles are known (see {@link cupboardOf}).
   */
  cupboard: ReadonlySet<string>;
}

/** Aisles whose things live in the cupboard, not on this week's list. */
const CUPBOARD_AISLES = new Set(['spices', 'oils, vinegars & sauces', 'baking & sweeteners']);

/** The concepts shelved in the cupboard aisles, from the English names and the shopping-list aisles. */
export function cupboardOf(english: IngredientLookup, grocery: GroceryConcepts = {}): Set<string> {
  const shortest = new Map<string, string>();
  for (const [name, c] of Object.entries(english)) {
    const known = shortest.get(c);
    if (known === undefined || name.length < known.length) shortest.set(c, name);
  }
  const out = new Set<string>();
  for (const [c, name] of shortest) if (CUPBOARD_AISLES.has(grocery[c]?.[1] ?? aisleFor(name))) out.add(c);
  return out;
}

/** Words that name something made from an ingredient, in English or Italian. */
const PRODUCT_WORDS = new Set([
  'flour', 'milk', 'butter', 'oil', 'extract', 'powder', 'paste', 'cream', 'yogurt', 'yoghurt', 'cheese', 'syrup', 'starch',
  'sauce', 'sugar', 'vinegar', 'wine', 'meal', 'flakes', 'chips', 'protein', 'noodles', 'pasta', 'bread', 'jam', 'dough',
  'farina', 'latte', 'burro', 'olio', 'estratto', 'polvere', 'crema', 'panna', 'formaggio', 'sciroppo', 'amido', 'salsa',
  'zucchero', 'aceto', 'vino', 'pane', 'impasto', 'marmellata', 'confettura'
]);

const STAPLE_NAMES = ['salt', 'water', 'black pepper', 'pepper', 'ice'];

const words = (name: string) => name.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/**
 * The kitchen for a catalog. `parents` holds each concept's parents by position, as catalog.json packs them;
 * `lookup` (names → concepts, any language) finds the staples and tells products from their source.
 */
export function kitchenOf(concepts: readonly string[], parents: readonly (readonly number[])[], lookup: IngredientLookup, cupboard: ReadonlySet<string> = new Set()): Kitchen {
  const direct = new Map<string, string[]>(concepts.map((c, i) => [c, (parents[i] ?? []).map((p) => concepts[p]!)]));
  const ancestors = new Map<string, Set<string>>();
  const climb = (c: string): Set<string> => {
    let found = ancestors.get(c);
    if (found) return found;
    found = new Set();
    ancestors.set(c, found);
    for (const p of direct.get(c) ?? []) {
      if (p === c) continue;
      found.add(p);
      for (const a of climb(p)) if (a !== c) found.add(a);
    }
    return found;
  };
  for (const c of concepts) climb(c);

  const names = new Map<string, Set<string>>();
  for (const [name, c] of Object.entries(lookup)) (names.get(c) ?? names.set(c, new Set()).get(c)!).add(name);
  const productWords = (c: string) => {
    const found = new Set<string>();
    for (const name of names.get(c) ?? []) {
      // "almond flour", "farina di mandorle": the product word can sit anywhere in the name.
      for (const w of words(name)) if (PRODUCT_WORDS.has(w)) found.add(w);
    }
    return found;
  };
  const products = new Set<string>();
  for (const [c, ps] of direct) {
    const own = productWords(c);
    if (!own.size) continue;
    // "olive oil" under "vegetable oil" is still an oil; "almond flour" under "almond" is a product.
    if (ps.some((p) => ![...own].some((w) => productWords(p).has(w)))) products.add(c);
  }

  const staples = new Set(STAPLE_NAMES.flatMap((n) => lookupConcept(n, lookup) ?? []));
  return { ancestors, parents: direct, products, staples, cupboard };
}

/** The concepts a recipe names itself: those none of its other concepts implies. */
export function ownConcepts(concepts: readonly string[], kitchen: Kitchen): string[] {
  const implied = new Set<string>();
  for (const c of concepts) for (const a of kitchen.ancestors.get(c) ?? []) implied.add(a);
  return concepts.filter((c) => !implied.has(c));
}

function held(have: ReadonlySet<string>, concept: string, kitchen: Kitchen): boolean {
  if (have.has(concept)) return true;
  // Extra-firm tofu is tofu: the specific stands in for the general.
  for (const h of have) if (kitchen.ancestors.get(h)?.has(concept)) return true;
  // Tofu stands in for extra-firm tofu, but almonds are not almond flour.
  return !kitchen.products.has(concept) && (kitchen.parents.get(concept) ?? []).some((p) => have.has(p));
}

/** Never bought for a recipe: a staple, or kept in the cupboard. */
const isStaple = (concept: string, kitchen: Kitchen) => kitchen.cupboard.has(concept) || held(kitchen.staples, concept, kitchen);

/** How a recipe sits with what the cook has: what it still needs, and how many of the cook's things it uses. */
export interface FridgeFit {
  missing: string[];
  used: number;
}

export function fridgeFit(own: readonly string[], have: ReadonlySet<string>, kitchen: Kitchen): FridgeFit {
  const missing: string[] = [];
  let used = 0;
  for (const c of own) {
    if (isStaple(c, kitchen)) continue;
    if (held(have, c, kitchen)) used++;
    else missing.push(c);
  }
  return { missing, used };
}

/** At most this many things to buy for a recipe to count as cookable from the fridge. */
export const FRIDGE_MISSING = 3;

/**
 * Recipes the cook can make from what they have: the ones that use most of it and send them shopping least
 * come first, and ties keep the given order (best rated first). A recipe has to use two of the cook's things
 * (one, with one in the fridge): a dressing of chickpea water is not dinner from a full fridge.
 */
export function fridgeOrder<R>(
  recipes: readonly R[],
  have: ReadonlySet<string>,
  kitchen: Kitchen,
  conceptsOf: (recipe: R) => readonly string[],
  maxMissing = FRIDGE_MISSING
): { recipe: R; missing: string[] }[] {
  const fits: { recipe: R; missing: string[]; used: number; at: number }[] = [];
  recipes.forEach((recipe, at) => {
    const fit = fridgeFit(ownConcepts(conceptsOf(recipe), kitchen), have, kitchen);
    if (fit.used >= Math.min(2, have.size) && fit.missing.length <= maxMissing) fits.push({ recipe, ...fit, at });
  });
  // Each thing to buy weighs one and a half of the cook's own: using four and buying one beats using one.
  const score = (f: { missing: string[]; used: number }) => f.used - f.missing.length * 1.5;
  fits.sort((a, b) => score(b) - score(a) || a.missing.length - b.missing.length || a.at - b.at);
  return fits.map(({ recipe, missing }) => ({ recipe, missing }));
}

/** What a week of recipes asks the shop for. */
export interface WeekStats {
  /** Different things to buy for the whole week, staples left out. */
  items: number;
  /** What the recipes list between them, counting a repeat each time. */
  separate: number;
  /** Ingredients two or more recipes use, most shared first. */
  shared: { concept: string; recipes: number }[];
}

function shopping(concepts: readonly string[], kitchen: Kitchen): string[] {
  return ownConcepts(concepts, kitchen).filter((c) => !isStaple(c, kitchen));
}

export function weekStats(week: readonly (readonly string[])[], kitchen: Kitchen): WeekStats {
  const uses = new Map<string, number>();
  let separate = 0;
  for (const concepts of week) {
    const list = new Set(shopping(concepts, kitchen));
    separate += list.size;
    for (const c of list) uses.set(c, (uses.get(c) ?? 0) + 1);
  }
  const shared = [...uses].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([concept, recipes]) => ({ concept, recipes }));
  return { items: uses.size, separate, shared };
}

export interface WeekOptions {
  count: number;
  /** Recipe ids to keep where they are; a null or missing slot is filled. */
  slots?: readonly (string | null)[];
  /** Recipes the cook already turned down. */
  avoid?: ReadonlySet<string>;
  random?: () => number;
}

/** How alike two shopping lists are: what they share over what they need between them (0 to 1). */
function likeness(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const other = new Set(b);
  const both = a.filter((c) => other.has(c)).length;
  return both / (a.length + b.length - both);
}

/** Words in a title that name nothing about the dish. */
const PLAIN_WORDS = new Set(['vegan', 'easy', 'best', 'quick', 'simple', 'recipe', 'with', 'and', 'the', 'minute', 'minutes', 'healthy', 'homemade', 'ever', 'perfect', 'ultimate', 'make', 'how', 'style', 'free', 'gluten', 'oil', 'one', 'pot', 'pan', 'sheet', 'instant', 'creamy', 'crispy', 'spicy', 'vegana', 'vegano', 'vegane', 'vegani', 'facile', 'ricetta', 'con', 'senza', 'alla', 'della', 'delle']);

/** The words that say what a dish is ("lentil", "wellington"), plural or not. */
function dishWords(title: string): string[] {
  return [...new Set(title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length > 3 && !PLAIN_WORDS.has(w)).map((w) => w.replace(/(?<=[^s])s$/, '')))];
}

/** The first dinner comes from this many of the best matches; the rest follow what it needs. */
const OPENERS = 30;
/** Each later dinner is drawn from the best few fits, so a new plan is not always the same plan. */
const SHORTLIST = 3;

/**
 * A week of dinners that share their shopping: each recipe added uses as much as it can of what the others
 * already need and adds as little as it can, a well rated recipe wins a close call, and no blog cooks twice
 * while another can. `pool` comes best first.
 */
export function planWeek<R extends { id: string; source: string; title: string }>(
  pool: readonly R[],
  conceptsOf: (recipe: R) => readonly string[],
  kitchen: Kitchen,
  { count, slots = [], avoid = new Set(), random = Math.random }: WeekOptions
): R[] {
  const byId = new Map(pool.map((r) => [r.id, r]));
  const week: (R | null)[] = Array.from({ length: count }, (_, i) => byId.get(slots[i] ?? '') ?? null);
  const lists = new Map<string, string[]>();
  const listOf = (r: R) => lists.get(r.id) ?? lists.set(r.id, shopping(conceptsOf(r), kitchen)).get(r.id)!;
  for (let slot = 0; slot < count; slot++) {
    if (week[slot]) continue;
    const chosen = week.filter((r): r is R => !!r);
    const taken = new Set(chosen.map((r) => r.id));
    const candidates = pool.filter((r) => !taken.has(r.id) && !avoid.has(r.id));
    if (!candidates.length) break;
    if (!chosen.length) {
      week[slot] = candidates[Math.floor(random() * Math.min(OPENERS, candidates.length))]!;
      continue;
    }
    const needed = new Set(chosen.flatMap(listOf));
    const blogs = new Set(chosen.map((r) => r.source));
    const planned = new Set(chosen.flatMap((r) => dishWords(r.title)));
    const scored = candidates.map((r, at) => {
      const list = listOf(r);
      const shared = list.filter((c) => needed.has(c)).length;
      const added = list.length - shared;
      // Sharing the shopping is the point, but three red lentil dals are not a week.
      const twin = Math.max(0, ...chosen.map((other) => likeness(list, listOf(other))));
      // Nor are three Wellingtons: a dish named like one already planned waits its turn.
      const named = dishWords(r.title).filter((w) => planned.has(w)).length;
      const score = shared * 2 - added * 0.5 - (at / candidates.length) * 2 - (blogs.has(r.source) ? 3 : 0) - twin * twin * 24 - named * 10;
      return { r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    week[slot] = scored[Math.floor(random() * Math.min(SHORTLIST, scored.length))]!.r;
  }
  return week.filter((r): r is R => !!r);
}
