import { normalizeLine } from './ingredients';

/**
 * Safety net on top of all-vegan sources: flags ingredient lines that name an
 * animal product with no plant-based qualifier. False positives only drop a
 * recipe; false negatives would show a non-vegan one, so this errs strict.
 */
const ANIMAL_TERMS: [string, RegExp][] = [
  ['egg', /\beggs?\b|\begg (?:yolks?|whites?)\b|\byolks?\b/],
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
      'egg replacer', 'substitute', 'alternative', 'imitation', 'beyond', 'impossible', 'gardein', 'tofurky',
      'violife', 'daiya', "miyoko'?s?", 'kite hill', 'follow your heart', 'tofutti', 'earth balance',
      'country crock', 'chickpea', 'jackfruit', 'seitan', 'tofu', 'tempeh', 'mushroom', 'soy curls?', 'tvp',
      'no[\\s-]?chicken', 'no[\\s-]?beef', 'not[\\s-]?chicken', "chick'?n", 'chik', '[a-z]+-style', 'bouillon',
      'seasoning', 'seaweed', 'nori', 'kelp', 'banana blossom', 'coconut', 'cashew', 'almond', 'oat',
      'soy(?:milk)?', 'rice', 'hemp', 'pea', 'macadamia', 'hazelnut', 'pistachio', 'walnut', 'pecan', 'peanut',
      'sunflower', 'sesame', 'tahini', 'pumpkin', 'seed', 'nut', 'cocoa', 'cacao', 'shea', 'apple', 'cookie',
      'biscoff', 'butternut', 'vegetable', 'veggie', 'maple', 'agave', 'date', 'nice', 'cream of tartar'
    ].join('|') +
    String.raw`)\b`
);

/** Lines that are headings or tips rather than ingredients. */
const NON_INGREDIENT = /^(?:for the|note|tip|see|garnish|serve)\b/i;

/** Return the animal-product categories found, empty when the list looks vegan. */
export function findNonVegan(lines: string[]): { term: string; line: string }[] {
  const hits: { term: string; line: string }[] = [];
  for (const raw of lines) {
    const line = normalizeLine(raw).toLowerCase();
    if (!line || NON_INGREDIENT.test(line)) continue;
    const term = ANIMAL_TERMS.find(([, re]) => re.test(line))?.[0];
    if (term && !PLANT_QUALIFIER.test(line)) hits.push({ term, line });
  }
  return hits;
}
