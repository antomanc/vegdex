import { normalizeLine, parseIngredient } from './ingredients';
import { isQualifiedIngredient, type IngredientLookup } from './concepts';
import { findUnsafeRenderedTerms } from './translations';

/** OFF's explicit/inherited status; missing evidence is never treated as vegan. */
export type ConceptVeganStatus = 'yes' | 'no' | 'maybe' | 'unknown';

/** Unmapped or uncertain English ingredients still rely on the separate text check. */
export function findNonVeganConcepts(lines: string[], lookup: IngredientLookup, vegan: Record<string, ConceptVeganStatus>, language = 'en'): { concept: string; line: string }[] {
  if (language !== 'en') return lines.flatMap((line) => {
    const concept = parseIngredient(line, lookup, language).concept;
    return concept && vegan[concept] === 'no' ? [{ concept, line }] : [];
  });
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

const isQualified = (text: string) => PLANT_QUALIFIER.test(text.toLowerCase()) || isQualifiedIngredient(text);

/**
 * The separate ingredients named on one line, each with its own notes, so a qualifier
 * on one never excuses another. Only the primary option of an alternative counts.
 */
function ingredientOptions(line: string, lookup: IngredientLookup): string[] {
  line = line.replace(/\(\s*(?:or|oder|bzw\.?)\s+[^)]*\)?/gi, ' ');
  // "Vegan protein of choice: tofu, sausages" qualifies the whole list; "Topping: quark" does not.
  const label = line.match(/^([^:\d(]+):/);
  if (label) {
    if (isQualified(label[1]!)) return [];
    line = line.slice(label[0].length);
  }
  // "vegan cheese i use a mix of vegan mozzarella and parmesan" is one ingredient and its note.
  const noteAt = line.search(/\bi (?:use|used|like|prefer)\b/i);
  const note = noteAt > 0 ? line.slice(noteAt) : '';
  if (note) line = line.slice(0, noteAt);
  const parts: string[] = [];
  let start = 0;
  // "mac and cheese" and "bread and butter" name one ingredient.
  for (const match of line.matchAll(/\([^)]*\)?|[,;]\s*|(?<!\b(?:mac|macaroni|bread))\s+(?:and|&|\+|with|or|oder|bzw\.?)\s+/gi)) {
    if (match[0].startsWith('(')) continue;
    const rest = line.slice(match.index + match[0].length);
    const next = rest.split(/[,;(]|\s+(?:and|&|\+|with|or|oder|bzw\.?)\s+/i)[0]!;
    if (/\b(?:or|oder|bzw)\b/i.test(match[0])) {
      // "romano or ramiro pepper" may share its noun: parsing reads the whole alternative,
      // unless that would let a qualified alternative ("quark or vegan butter") hide the primary.
      parts.push(isQualified(next) ? line.slice(start, match.index) : line.slice(start));
      return withNote(parts, note);
    }
    if (/^[,;]/.test(match[0])) {
      const tail = rest.replace(/\([^)]*\)?/g, ' ');
      // "chanterelle, oyster, or cremini mushrooms" lists alternatives of one ingredient.
      if (!/^\d/.test(rest) && (/,\s*(?:or|oder|bzw)\b/i.test(tail) || /^[^,;]*\b(?:or|oder|bzw)\b[^,;]*$/i.test(tail))) {
        parts.push(line.slice(start, match.index));
        return withNote(parts, note);
      }
      // Commas usually introduce preparation notes; split only where a recognizable ingredient starts.
      if (!/^\d/.test(next) && !parseIngredient(next, lookup).concept) continue;
    } else if (!parseIngredient(next.replace(/\([^)]*\)?/g, ' '), lookup).name) continue; // "1/2 cup milk + 2 tablespoons"
    parts.push(line.slice(start, match.index));
    start = match.index + match[0].length;
  }
  parts.push(line.slice(start));
  return withNote(parts, note);
}

const withNote = (parts: string[], note: string) => note ? [...parts.slice(0, -1), `${parts.at(-1)} ${note}`] : parts;

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
export function findNonVegan(lines: string[], language = 'en'): { term: string; line: string }[] {
  if (language !== 'en') return lines.flatMap((line) => findUnsafeRenderedTerms(line, language).map((term) => ({ term, line })));
  const hits: { term: string; line: string }[] = [];
  for (const raw of lines) {
    const line = normalizeLine(raw).toLowerCase();
    if (!line || NON_INGREDIENT.test(line)) continue;
    // Only the ingredient itself counts, not asides like "(omit for unsalted butter)" or "or more milk".
    const item = line.replace(/\([^)]*\)?/g, ' ').split(/,|;|\s(?:or|oder|bzw\.?)\s/)[0]!;
    const term = ANIMAL_TERMS.find(([, re]) => re.test(item))?.[0];
    // Qualifiers count anywhere in the same option ("parmesan, optional (i used violife)"),
    // but not in an alternative: "2 eggs, or 2 flax eggs" is still eggs.
    const outside = line.replace(/\([^)]*\)?/g, (m) => m.replace(/\s(?:or|oder|bzw\.?)\s/g, ' / '));
    const option = outside.split(/\s(?:or|oder|bzw\.?)\s/)[0]!;
    if (term && !PLANT_QUALIFIER.test(option)) hits.push({ term, line });
  }
  return hits;
}
