import { parseIngredient, unitDef } from './ingredients';
import { formatMetric, toMetric, type Units } from './metric';

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
  ['produce', /\b(?:onion|garlic|ginger|lemon|lime|orange|apple|banana|berr|tomato|potato|carrot|celery|spinach|kale|lettuce|cabbage|broccoli|cauliflower|zucchini|squash|pumpkin|pepper(?!corn)|chili|jalape|cucumber|avocado|mushroom|herb|cilantro|parsley|basil|mint|dill|thyme|rosemary|green onion|leek|shallot|eggplant|corn|pea\b|bean sprout|beet|radish|fruit|grape|mango|pineapple|peach|pear|plum|cherry|date|fig|sweet potato|arugula|chard|bok choy|fennel|asparagus|okra|green bean|edamame|sprout)/],
  ['tofu & alternatives', /\b(?:tofu|tempeh|seitan|vegan (?:butter|cheese|yogurt|sausage)|plant[\s-]based|yogurt|soy curl|jackfruit)/],
  ['plant milk & cream', /(?<!coconut )\b(?:milk|cream|creamer)\b/],
  ['grains & pasta', /\b(?:rice|quinoa|oats?|pasta|spaghetti|noodle|couscous|bulgur|farro|barley|bread|tortilla|pita|wrap|bun|flour|polenta|cornmeal|panko|breadcrumb)/],
  ['beans & legumes', /\b(?:bean|chickpea|lentil|split pea)/],
  ['nuts & seeds', /\b(?:almond|cashew|walnut|pecan|peanut|hazelnut|pistachio|seed|tahini|nut butter|coconut flake|shredded coconut)/],
  ['spices', /\b(?:salt|pepper|cumin|paprika|turmeric|cinnamon|nutmeg|clove|cardamom|coriander|oregano|chili powder|curry powder|garam masala|spice|seasoning|cayenne|bay lea|vanilla|baking (?:soda|powder)|yeast)/],
  ['baking & sweeteners', /\b(?:sugar|maple|agave|syrup|chocolate|cocoa|cacao|molasses|cornstarch|starch|arrowroot|xanthan)/],
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

/**
 * Combine ingredient lines from several recipes into one shopping list:
 * same canonical name → one row, quantities summed per dimension.
 */
export function compileGroceryList(inputs: GroceryInput[], { units = 'us' }: { units?: Units } = {}): GroceryItem[] {
  interface Acc {
    volume: number;
    mass: number;
    /** Some of the mass was weighed through the density table. */
    estimate: boolean;
    count: number;
    other: Map<string, number>;
    toTaste: boolean;
    recipeIds: Set<string>;
    lines: string[];
  }
  const groups = new Map<string, Acc>();
  const CANNED = new Set(['can', 'jar']);

  for (const input of inputs) {
    for (const line of input.ingredients) {
      const p = parseIngredient(line);
      if (!p.name) continue;
      const acc: Acc =
        groups.get(p.name) ??
        { volume: 0, mass: 0, estimate: false, count: 0, other: new Map(), toTaste: false, recipeIds: new Set(), lines: [] };
      groups.set(p.name, acc);
      acc.recipeIds.add(input.recipeId);
      acc.lines.push(p.raw);
      if (p.quantity === null) {
        acc.toTaste = true;
        continue;
      }
      // Use the upper end of ranges: better to buy slightly too much.
      const q = (p.quantityMax ?? p.quantity) * input.multiplier;
      const def = p.unit ? unitDef(p.unit) : undefined;
      const metric = units === 'metric' ? toMetric(p) : null;
      if (metric) {
        // toMetric already scaled by the line's quantity; take the same end of the range.
        const amount = (metric.quantityMax ?? metric.quantity) * input.multiplier;
        if (metric.unit === 'g') acc.mass += amount;
        else if (metric.unit === 'ml') acc.volume += amount;
        else acc.other.set('cm', (acc.other.get('cm') ?? 0) + amount);
        acc.estimate ||= metric.estimate;
        continue;
      }
      if (!def) acc.count += q;
      else if (def.dimension === 'volume') {
        // Grams in parentheses are more precise than cups for solids; prefer them.
        if (p.metric?.unit === 'g') acc.mass += p.metric.quantity * input.multiplier;
        else acc.volume += q * def.factor;
      } else if (def.dimension === 'mass') acc.mass += q * def.factor;
      else acc.other.set(def.unit, (acc.other.get(def.unit) ?? 0) + q);
    }
  }

  const items: GroceryItem[] = [];
  for (const [name, acc] of groups) {
    const amounts: string[] = [];
    const metric = units === 'metric';
    if (acc.mass) amounts.push(metric ? formatMetric({ quantity: acc.mass, quantityMax: null, unit: 'g', estimate: acc.estimate }) : formatMass(acc.mass));
    if (acc.volume) amounts.push(metric ? formatMetricVolume(acc.volume) : formatVolume(acc.volume));
    if (acc.count) amounts.push(fmt(acc.count));
    for (const [unit, q] of acc.other)
      amounts.push(unit === 'cm' ? formatMetric({ quantity: q, quantityMax: null, unit: 'cm', estimate: false }) : `${fmt(q)} ${plural(unit, q)}`);
    // "1 can diced tomatoes" is bought canned, not from the produce aisle.
    const onlyCanned = !acc.mass && !acc.volume && !acc.count && acc.other.size > 0 && [...acc.other.keys()].every((u) => CANNED.has(u));
    const aisle = aisleFor(name);
    items.push({
      name,
      aisle: aisle === 'produce' && onlyCanned ? 'canned & jarred' : aisle,
      amounts,
      toTaste: acc.toTaste && amounts.length === 0,
      recipeIds: [...acc.recipeIds],
      lines: acc.lines
    });
  }
  return items.sort((a, b) => STORE_WALK.indexOf(a.aisle) - STORE_WALK.indexOf(b.aisle) || a.name.localeCompare(b.name));
}
