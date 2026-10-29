import { normalizeLine, parseIngredient } from './ingredients';
import type { IngredientLookup } from './concepts';

/** OFF's explicit/inherited status; missing evidence is never treated as vegan. */
export type ConceptVeganStatus = 'yes' | 'no' | 'maybe' | 'unknown';

/** Unmapped or uncertain English ingredients still rely on the separate text check. */
export function findNonVeganConcepts(lines: string[], lookup: IngredientLookup, vegan: Record<string, ConceptVeganStatus>): { concept: string; line: string }[] {
  return lines.flatMap((line) => {
    const normalized = normalizeLine(line);
    if (NON_INGREDIENT.test(normalized)) return [];
    return ingredientOptions(normalized, lookup).flatMap((option) => {
      const concept = parseIngredient(option, lookup).concept;
      // Same scope as the text check: a qualifier on this option ("(i used soy yogurt)") counts.
      return concept && vegan[concept] === 'no' && !PLANT_QUALIFIER.test(option.toLowerCase()) ? [{ concept, line }] : [];
    });
  });
}

/** Keep notes attached, but never let another ingredient or alternative supply a qualifier. */
function ingredientOptions(line: string, lookup: IngredientLookup = {}): string[] {
  line = line.replace(/\(\s*(?:or|oder|bzw\.?)\s+[^)]*\)?/gi, ' ');
  const parts: string[] = [];
  let start = 0;
  // "mac and cheese" and "bread and butter" name one ingredient.
  for (const match of line.matchAll(/\([^)]*\)?|[,;]\s*|(?<!\b(?:mac|macaroni|bread))\s+(?:and|&|\+|with|or|oder|bzw\.?)\s+/gi)) {
    if (match[0].startsWith('(')) continue;
    if (/^[,;]/.test(match[0])) {
      const rest = line.slice(match.index + match[0].length);
      if (/^(?:or|oder|bzw)\b/i.test(rest)) return [...parts, line.slice(start, match.index)];
      const next = rest.split(/[,;(]|\s+(?:and|&|\+|with|or|oder|bzw\.?)\s+/i)[0]!;
      // Commas usually introduce preparation notes; split only where a recognizable ingredient starts.
      if (!/^\d/.test(next) && !parseIngredient(next, lookup).concept && !ANIMAL_TERMS.some(([, re]) => re.exec(next.toLowerCase())?.index === 0)) continue;
    }
    parts.push(line.slice(start, match.index));
    // As in the text check, the primary option defines the ingredient.
    if (/\b(?:or|oder|bzw)\b/i.test(match[0])) return parts;
    start = match.index + match[0].length;
  }
  parts.push(line.slice(start));
  return parts;
}

/**
 * Safety net on top of all-vegan sources: flags ingredient lines that name an
 * animal product with no plant-based qualifier. False positives only drop a
 * recipe; false negatives would show a non-vegan one, so this errs strict.
 */
const ANIMAL_TERMS: [string, RegExp][] = [
  ['egg', /\beggs?\b|\begg (?:yolks?|whites?)\b|\byolks?\b|\bmayo(?:nnaise)?\b|\bkewpie\b|\bladyfingers?\b|\bsavoiardi\b|\baioli\b/],
  ['butter', /\bbutter\b(?![\s-]?(?:beans?|lettuce|extract|flavou?r))/],
  ['ghee', /\bghee\b/],
  ['milk', /\b(?:whole |skim |cow'?s |dairy |condensed |evaporated |powdered )?milk\b(?!\s?(?:of choice|alternative|substitute))/],
  ['cream', /\b(?:heavy |double |single |whipping |sour )?cream\b(?! of tartar)/],
  ['cheese', /\b(?:cheese|parmesan|parmigiano|cheddar|mozzarella|feta|ricotta|mascarpone|gruyere|brie|halloumi|paneer|pecorino|gouda)\b/],
  ['yogurt', /\b(?:yogh?urt|yoghourt)\b/],
  ['honey', /\bhoney\b(?![\s-]?dew)/],
  ['gelatin', /\bgelatine?\b/],
  ['meat', /\b(?:chicken|beef|pork|bacon|ham|lamb|turkey|veal|duck|sausage|prosciutto|pancetta|chorizo|salami|pepperoni|lard|suet|bone broth)\b/],
  ['fish', /\b(?:fish|anchov(?:y|ies)|tuna|salmon|shrimp|prawns?|crab|lobster|scallops?|oysters?|clams?|mussels?|squid|cod|sardines?|bonito|dashi)\b/],
  ['other', /\b(?:worcestershire|isinglass|carmine|cochineal|whey|casein)\b/]
];

/** Words on the same line that mark the flagged term as a plant-based version. */
const PLANT_QUALIFIER = new RegExp(
  String.raw`\b(?:` +
    [
      'vegan', 'plant[\\s-]?based', 'plant', 'dairy[\\s-]?free', 'non[\\s-]?dairy', 'nondairy', 'meatless',
      'meat[\\s-]?free', 'egg[\\s-]?free', 'eggless', 'flax(?:seed)?', 'chia', 'aquafaba', 'just egg',
      'egg replacer', 'egg replace\\w*', 'substitute', 'alternative', 'imitation', 'beyond', 'impossible', 'gardein', 'tofurky',
      'violife', 'daiya', "miyoko'?s?", 'kite hill', 'follow your heart', 'tofutti', 'earth balance',
      'country crock', 'chickpea', 'jackfruit', 'seitan', 'tofu', 'tempeh', 'mushroom', 'soy curls?', 'tvp',
      'no[\\s-]?chicken', 'no[\\s-]?beef', 'not[\\s-]?chicken', "chick'?n", 'chik', '[a-z]+-style', 'bouillon',
      'seasoning', 'seaweed', 'nori', 'kelp', 'banana blossom', 'coconut', 'cashew', 'almond', 'oat',
      'soy(?:milk)?', 'rice', 'hemp', 'pea', 'macadamia', 'hazelnut', 'pistachio', 'walnut', 'pecan', 'peanut',
      'sunflower', 'sesame', 'tahini', 'pumpkin', 'seed', 'nut', 'cocoa', 'cacao', 'shea', 'apple', 'cookie',
      'biscoff', 'butternut', 'vegetable', 'veggie', 'maple', 'agave', 'date', 'nice', 'cream of tartar',
      // All sources are vegan blogs: a serving suggestion of ice cream there is vegan ice cream.
      'ice cream', 'whipped topping',
      // German-language recipes (ElaVegan publishes both).
      'veganer?', 'veganen?', 'veganes',
      'flavou?r(?:ed)?', 'oatly', 'egg[\\s-]?like', 'egg roll', 'egg[\\s-]?sized', 'kala namak', 'black salt', 'bits',
      'butter lettuce', "lamb'?s lettuce", 'beef(?:steak)? tomato(?:e?s)?', 'mock', 'faux', 'tofurkey', 'spice (?:mix|blend)',
      'golden milk', 'milk bag', 'starter', 'easter egg', 'stabili[sz]er', 'oyster (?:crackers?|mushrooms?)', 'cream (?:of )?tart[ae]r', 'bread (?:&|and) butter',
      // References to a component made earlier in the same recipe.
      'from above', 'recipe', 'mixture', 'batter', 'powder from'
    ].join('|') +
    String.raw`)s?\b`
);

/** Lines that are headings or tips rather than ingredients. */
const NON_INGREDIENT = /^(?:for the|note|tip|see|garnish|serve)\b/i;

/** Return the animal-product categories found, empty when the list looks vegan. */
export function findNonVegan(lines: string[]): { term: string; line: string }[] {
  const hits: { term: string; line: string }[] = [];
  for (const raw of lines) {
    const line = normalizeLine(raw).toLowerCase();
    if (!line || NON_INGREDIENT.test(line)) continue;
    for (const option of ingredientOptions(line)) {
      // Only the ingredient itself counts, not asides like "(omit for unsalted butter)".
      const item = option.replace(/\([^)]*\)?/g, ' ').split(/,/)[0]!;
      const term = ANIMAL_TERMS.find(([, re]) => re.test(item))?.[0];
      // Notes can qualify the same ingredient ("parmesan, optional (i used violife)").
      if (term && !PLANT_QUALIFIER.test(option)) hits.push({ term, line });
    }
  }
  return hits;
}
