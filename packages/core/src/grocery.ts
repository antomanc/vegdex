import { lookupConcept, type IngredientLookup } from './concepts';
import { parseIngredient, unitDef, type ParsedIngredient } from './ingredients';
import { formatMetric, toMetric, type Units } from './metric';
import { gramsPerCup } from './weights';

export interface GroceryInput {
  recipeId: string;
  ingredients: string[];
  /** Multiply every quantity by this (servings scaling). */
  multiplier: number;
}

export interface GroceryItem {
  name: string;
  aisle: string;
  /** Human-readable totals, e.g. ["1 ½ cups (360 ml)", "2 cans"]. */
  amounts: string[];
  /** True when at least one recipe gave no quantity ("salt to taste"). */
  toTaste: boolean;
  recipeIds: string[];
  lines: string[];
}

const AISLES: [string, RegExp][] = [
  // Dried spices named after produce ("garlic powder", "black pepper") are sold with the spices.
  ['spices', /\b(?:black pepper|white pepper|peppercorn|cayenne|paprika|(?:chili|chilli|chile|garlic|onion|ginger|curry|chipotle|mustard) powder|(?:chili|chilli|pepper) flake)/],
  ['produce', /\b(?:onion|garlic|ginger|lemon|lime|orange|apple|banana|berr|tomato|potato|carrot|celery|spinach|kale|lettuce|cabbage|broccoli|cauliflower|zucchini|squash|pumpkin|pepper(?!corn)|chili|jalape|cucumber|avocado|mushroom|herb|cilantro|parsley|basil|mint|dill|thyme|rosemary|green onion|leek|shallot|eggplant|corn(?! ?(?:starch|flour|meal|flake|bread|syrup))|pea\b|bean sprout|beet|radish|fruit|grape|mango|pineapple|peach|pear|plum|cherry|date|fig|sweet potato|arugula|chard|bok choy|fennel|asparagus|okra|green bean|edamame|sprout)/],
  ['tofu & alternatives', /\b(?:tofu|tempeh|seitan|vegan (?:butter|cheese|yogurt|sausage)|plant[\s-]based|yogurt|soy curl|jackfruit)/],
  ['plant milk & cream', /(?<!coconut )\b(?:milk|cream|creamer)\b/],
  ['grains & pasta', /\b(?:rice|quinoa|oats?|pasta|spaghetti|noodle|couscous|bulgur|farro|barley|bread|tortilla|pita|wrap|bun|(?<!corn ?)flour|polenta|cornmeal|panko|breadcrumb)/],
  ['beans & legumes', /\b(?:(?<!vanilla )bean|chickpea|lentil|split pea)/],
  ['nuts & seeds', /\b(?:almond|cashew|walnut|pecan|peanut|hazelnut|pistachio|seed|tahini|nut butter|coconut flake|shredded coconut)/],
  ['spices', /\b(?:salt|pepper|cumin|paprika|turmeric|cinnamon|nutmeg|clove|cardamom|coriander|oregano|chili powder|curry powder|garam masala|spice|seasoning|cayenne|bay lea|vanilla|baking (?:soda|powder)|yeast)/],
  ['baking & sweeteners', /\b(?:sugar|maple|agave|syrup|chocolate|cocoa|cacao|molasses|cornstarch|starch|corn ?flour|arrowroot|xanthan)/],
  ['oils, vinegars & sauces', /\b(?:oil|vinegar|soy sauce|tamari|miso|sauce|paste|ketchup|mustard|mayo|sriracha|broth|stock|bouillon|liquid smoke|nutritional yeast)/],
  ['canned & jarred', /\b(?:canned|can|jar|coconut milk|tomato sauce|crushed tomato|olive|caper|pickle)/]
];

/** The order you walk a typical store in; "other" always comes last. */
const STORE_WALK = [
  'produce',
  'tofu & alternatives',
  'grains & pasta',
  'beans & legumes',
  'canned & jarred',
  'nuts & seeds',
  'oils, vinegars & sauces',
  'spices',
  'baking & sweeteners',
  'plant milk & cream',
  'other'
];

export function aisleFor(name: string): string {
  return AISLES.find(([, re]) => re.test(name))?.[0] ?? 'other';
}

function fmt(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  const fracs: [number, string][] = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  let best = fracs[0]!;
  for (const f of fracs) if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f;
  const w = best[0] === 1 ? whole + 1 : whole;
  if (w === 0 && best[1]) return best[1];
  if (w === 0) return n > 0 ? '⅛' : '0';
  return best[1] ? `${w} ${best[1]}` : String(w);
}

function plural(unit: string, n: number): string {
  if (n <= 1 || ['g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'oz', 'lb', 'fl oz'].includes(unit)) return unit;
  if (unit === 'bunch') return 'bunches';
  if (unit === 'pinch') return 'pinches';
  if (unit === 'dash') return 'dashes';
  if (unit === 'inch') return 'inches';
  return unit + 's';
}

function formatVolume(ml: number): string {
  const metric = ml >= 1000 ? `${Math.round(ml / 100) / 10} l` : `${Math.round(ml)} ml`;
  if (ml >= 60) {
    const cups = ml / 240;
    return `${fmt(cups)} ${cups > 1.1 ? 'cups' : 'cup'} (${metric})`;
  }
  if (ml >= 15) return `${fmt(ml / 15)} tbsp`;
  return `${fmt(ml / 5)} tsp`;
}

/** Metric lists keep spoons for small amounts, like the recipe sheet, and give ml past a quarter cup. */
function formatMetricVolume(ml: number): string {
  if (ml >= 60) return formatMetric({ quantity: ml, quantityMax: null, unit: 'ml', estimate: false });
  if (ml >= 15) return `${fmt(ml / 15)} tbsp`;
  return `${fmt(ml / 5)} tsp`;
}

function formatMass(g: number): string {
  if (g >= 1000) return `${Math.round(g / 100) / 10} kg`;
  return `${Math.round(g)} g`;
}

/** The most common entry; ties go to the one `order` puts first. */
function majority(entries: string[], order: (a: string, b: string) => number): string {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e, (counts.get(e) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1] || order(x[0], y[0]))[0]![0];
}

/** The aisle most lines name; ties go to the store walk, "other" last. */
const vote = (aisles: string[]) => majority(aisles, (a, b) => STORE_WALK.indexOf(a) - STORE_WALK.indexOf(b));

/** Per concept, the name its shopping-list row uses and its aisle. */
export type GroceryConcepts = Record<string, [name: string, aisle: string]>;

/**
 * Name and aisle each concept shops under, from the catalog's own lines, so every synonym
 * lands on one row in one aisle: "chick peas" shops with "chickpeas", not with the peas.
 * Only the concept's own aliases name it: "ground ginger" parses to "ginger", fresh ginger's alias.
 * Concepts the catalog names one way and that file under that name are left out: their name already does it.
 */
export function groceryConcepts(parsed: ParsedIngredient[], lookup: IngredientLookup): GroceryConcepts {
  const byConcept = new Map<string, string[]>();
  for (const p of parsed) if (p.concept && p.name) (byConcept.get(p.concept) ?? byConcept.set(p.concept, []).get(p.concept)!).push(p.name);
  const out: GroceryConcepts = {};
  for (const [concept, all] of [...byConcept].sort((x, y) => x[0].localeCompare(y[0]))) {
    const aliases = all.filter((n) => lookupConcept(n, lookup) === concept);
    const names = aliases.length ? aliases : all;
    const name = majority(names, (a, b) => a.length - b.length || a.localeCompare(b));
    // A tie goes to the aisle the row's own name files under, then down the store walk with "other" last.
    const own = aisleFor(name);
    const walk = (a: string) => (a === own && a !== 'other' ? -1 : STORE_WALK.indexOf(a));
    const aisle = majority(names.map(aisleFor), (a, b) => walk(a) - walk(b));
    if (new Set(all).size > 1 || aisle !== own) out[concept] = [name, aisle];
  }
  return out;
}

/** Grams for a volume line through the density table, as metric mode weighs it; null when unknown. */
function weighed(p: ParsedIngredient, multiplier: number): number | null {
  const m = toMetric(p);
  if (m) return m.unit === 'g' ? (m.quantityMax ?? m.quantity) * multiplier : null;
  // Spoons stay spoons in metric mode, so weigh them here.
  const perCup = gramsPerCup(p.name);
  return perCup ? (((p.quantityMax ?? p.quantity!) * unitDef(p.unit!)!.factor * multiplier) / 240) * perCup : null;
}

/**
 * Combine ingredient lines from several recipes into one shopping list:
 * lines sharing a concept's row name (see groceryConcepts) or a canonical name → one row, quantities summed per dimension.
 * Volume joins mass only through the density table or the blogs' own grams for that ingredient.
 */
export function compileGroceryList(
  inputs: GroceryInput[],
  { units = 'us', lookup = {}, concepts = {} }: { units?: Units; lookup?: IngredientLookup; concepts?: GroceryConcepts } = {}
): GroceryItem[] {
  interface Acc {
    name: string;
    aisle: string;
    volume: number;
    /** The part of `volume` the density table weighs, in grams. */
    volumeGrams: number;
    /** The part of `volume` the table can't weigh. */
    unweighedMl: number;
    /** Volume lines that also gave grams: the blogs' own density for this ingredient. */
    blogMl: number;
    blogGrams: number;
    mass: number;
    /** Some of the mass was weighed through a density. */
    estimate: boolean;
    count: number;
    other: Map<string, number>;
    toTaste: boolean;
    recipeIds: Set<string>;
    lines: string[];
  }
  const CANNED = new Set(['can', 'jar']);

  const parsed: { input: GroceryInput; p: ParsedIngredient }[] = [];
  for (const input of inputs) {
    for (const line of input.ingredients) {
      const p = parseIngredient(line, lookup);
      if (!p.name) continue;
      // Sentence-like notes are not purchases; unquantified ingredients still are.
      if (p.quantity === null && /^(?:serve with|i|if you)\b|\bis a\b/.test(p.name)) continue;
      parsed.push({ input, p });
    }
  }
  // Concepts and unmapped lines with the same name share a row, as names did before concepts.
  const shopAs = (p: ParsedIngredient): [name: string, aisle: string] =>
    p.concept && Object.hasOwn(concepts, p.concept) ? concepts[p.concept]! : [p.name, aisleFor(p.name)];
  const votes = new Map<string, string[]>();
  for (const { p } of parsed) {
    const [name, aisle] = shopAs(p);
    (votes.get(name) ?? votes.set(name, []).get(name)!).push(aisle);
  }

  const groups = new Map<string, Acc>();
  for (const { input, p } of parsed) {
    const [name] = shopAs(p);
    let aisle = vote(votes.get(name)!);
    // "1 can diced tomatoes" is bought canned, not from the produce aisle.
    const canned = aisle === 'produce' && !!p.unit && CANNED.has(p.unit);
    if (canned) aisle = 'canned & jarred';
    const key = canned ? `${name} canned` : name;
    const acc: Acc = groups.get(key) ?? {
      name, aisle, volume: 0, volumeGrams: 0, unweighedMl: 0, blogMl: 0, blogGrams: 0,
      mass: 0, estimate: false, count: 0, other: new Map(), toTaste: false, recipeIds: new Set(), lines: []
    };
    groups.set(key, acc);
    acc.recipeIds.add(input.recipeId);
    acc.lines.push(p.raw);
    if (p.quantity === null) {
      acc.toTaste = true;
      continue;
    }
    // Use the upper end of ranges: better to buy slightly too much.
    const q = (p.quantityMax ?? p.quantity) * input.multiplier;
    const def = p.unit ? unitDef(p.unit) : undefined;
    const addVolume = (ml: number) => {
      acc.volume += ml;
      const g = weighed(p, input.multiplier);
      if (g === null) acc.unweighedMl += ml;
      else acc.volumeGrams += g;
    };
    const metric = units === 'metric' ? toMetric(p) : null;
    if (metric) {
      // toMetric already scaled by the line's quantity; take the same end of the range.
      const amount = (metric.quantityMax ?? metric.quantity) * input.multiplier;
      if (metric.unit === 'g') acc.mass += amount;
      else if (metric.unit === 'ml') addVolume(amount);
      else acc.other.set('cm', (acc.other.get('cm') ?? 0) + amount);
      acc.estimate ||= metric.estimate;
      if (metric.unit === 'g' && !metric.estimate && def?.dimension === 'volume') {
        acc.blogMl += q * def.factor;
        acc.blogGrams += amount;
      }
      continue;
    }
    if (!def) acc.count += q;
    else if (def.dimension === 'volume') {
      // Grams in parentheses are more precise than cups for solids; prefer them.
      if (p.metric?.unit === 'g') {
        acc.mass += p.metric.quantity * input.multiplier;
        acc.blogMl += q * def.factor;
        acc.blogGrams += p.metric.quantity * input.multiplier;
      } else addVolume(q * def.factor);
    } else if (def.dimension === 'mass') acc.mass += q * def.factor;
    else acc.other.set(def.unit, (acc.other.get(def.unit) ?? 0) + q);
  }

  const items: GroceryItem[] = [];
  for (const acc of groups.values()) {
    // One weight instead of "274 g + ⅓ cup", when every cup can be weighed.
    if (acc.mass && acc.volume && (!acc.unweighedMl || acc.blogMl)) {
      acc.mass += acc.volumeGrams + (acc.unweighedMl * acc.blogGrams) / (acc.blogMl || 1);
      acc.volume = 0;
      acc.estimate = true;
    }
    const amounts: string[] = [];
    const metric = units === 'metric';
    if (acc.mass) amounts.push(metric || acc.estimate ? formatMetric({ quantity: acc.mass, quantityMax: null, unit: 'g', estimate: acc.estimate }) : formatMass(acc.mass));
    if (acc.volume) amounts.push(metric ? formatMetricVolume(acc.volume) : formatVolume(acc.volume));
    if (acc.count) amounts.push(fmt(acc.count));
    for (const [unit, q] of acc.other)
      amounts.push(unit === 'cm' ? formatMetric({ quantity: q, quantityMax: null, unit: 'cm', estimate: false }) : `${fmt(q)} ${plural(unit, q)}`);
    items.push({
      name: acc.name,
      aisle: acc.aisle,
      amounts,
      toTaste: acc.toTaste && amounts.length === 0,
      recipeIds: [...acc.recipeIds],
      lines: acc.lines
    });
  }
  return items.sort((a, b) => STORE_WALK.indexOf(a.aisle) - STORE_WALK.indexOf(b.aisle) || a.name.localeCompare(b.name));
}
