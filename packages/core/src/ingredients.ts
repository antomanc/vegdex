import { cleanText } from './text';
import { isQualifiedIngredient, lookupBrand, lookupConcept, lookupTerm, type IngredientLookup } from './concepts';
import { nearName } from './spelling';
import { languagePacks, languageUnitPatterns } from './languages';
import { findUnsafeRenderedTerms } from './translations';

export type Dimension = 'volume' | 'mass' | 'count' | 'other';

interface UnitDef {
  unit: string;
  dimension: Dimension;
  /** Size in ml (volume) or g (mass); 1 for count/other. */
  factor: number;
}

const UNIT_ALIASES: [string[], UnitDef][] = [
  [['cups', 'cup', 'c'], { unit: 'cup', dimension: 'volume', factor: 240 }],
  [['tablespoons', 'tablespoon', 'tablepoons', 'tablepoon', 'tbsps', 'tbsp', 'tbs', 'tbl', 'T'], { unit: 'tbsp', dimension: 'volume', factor: 15 }],
  [['teaspoons', 'teaspoon', 'teaspooon', 'tsps', 'tsp', 't'], { unit: 'tsp', dimension: 'volume', factor: 5 }],
  [['milliliters', 'millilitres', 'milliliter', 'millilitre', 'ml'], { unit: 'ml', dimension: 'volume', factor: 1 }],
  [['liters', 'litres', 'liter', 'litre', 'l'], { unit: 'l', dimension: 'volume', factor: 1000 }],
  [['fluid ounces', 'fluid ounce', 'fl. oz.', 'fl. oz', 'fl oz'], { unit: 'fl oz', dimension: 'volume', factor: 29.57 }],
  [['quarts', 'quart', 'qt'], { unit: 'quart', dimension: 'volume', factor: 946 }],
  [['pints', 'pint', 'pt'], { unit: 'pint', dimension: 'volume', factor: 473 }],
  [['grams', 'gram', 'gr', 'g'], { unit: 'g', dimension: 'mass', factor: 1 }],
  [['kilograms', 'kilogram', 'kg'], { unit: 'kg', dimension: 'mass', factor: 1000 }],
  [['ounces', 'ounce', 'oz.', 'oz'], { unit: 'oz', dimension: 'mass', factor: 28.35 }],
  [['pounds', 'pound', 'lbs.', 'lbs', 'lb.', 'lb'], { unit: 'lb', dimension: 'mass', factor: 453.6 }],
  [['cloves', 'clove'], { unit: 'clove', dimension: 'other', factor: 1 }],
  [['cans', 'can', 'tins', 'tin'], { unit: 'can', dimension: 'other', factor: 1 }],
  [['packages', 'package', 'packs', 'pack', 'pkg', 'packets', 'packet', 'envelopes', 'envelope'], { unit: 'package', dimension: 'other', factor: 1 }],
  [['sachets', 'sachet'], { unit: 'sachet', dimension: 'other', factor: 1 }],
  [['roll'], { unit: 'roll', dimension: 'other', factor: 1 }],
  [['leaf'], { unit: 'leaf', dimension: 'other', factor: 1 }],
  [['blocks', 'block'], { unit: 'block', dimension: 'other', factor: 1 }],
  [['bunches', 'bunch'], { unit: 'bunch', dimension: 'other', factor: 1 }],
  [['handfuls', 'handful'], { unit: 'handful', dimension: 'other', factor: 1 }],
  [['sprigs', 'sprig'], { unit: 'sprig', dimension: 'other', factor: 1 }],
  [['stalks', 'stalk', 'stems', 'stem', 'ribs', 'rib'], { unit: 'stalk', dimension: 'other', factor: 1 }],
  [['heads', 'head'], { unit: 'head', dimension: 'other', factor: 1 }],
  [['slices', 'slice'], { unit: 'slice', dimension: 'other', factor: 1 }],
  [['sheets', 'sheet'], { unit: 'sheet', dimension: 'other', factor: 1 }],
  [['pinches', 'pinch'], { unit: 'pinch', dimension: 'other', factor: 1 }],
  [['dashes', 'dash'], { unit: 'dash', dimension: 'other', factor: 1 }],
  [['inches', 'inch', 'in.', '"'], { unit: 'inch', dimension: 'other', factor: 1 }],
  [['jars', 'jar'], { unit: 'jar', dimension: 'other', factor: 1 }],
  [['bags', 'bag'], { unit: 'bag', dimension: 'other', factor: 1 }],
  [['scoops', 'scoop'], { unit: 'scoop', dimension: 'other', factor: 1 }],
  [['pieces', 'piece'], { unit: 'piece', dimension: 'other', factor: 1 }],
  [['centimeters', 'centimetres', 'centimeter', 'centimetre', 'cm'], { unit: 'cm', dimension: 'other', factor: 1 }],
  [['boxes', 'box'], { unit: 'box', dimension: 'other', factor: 1 }],
  [['bottles', 'bottle'], { unit: 'bottle', dimension: 'other', factor: 1 }],
  [['cartons', 'carton'], { unit: 'carton', dimension: 'other', factor: 1 }],
  [['containers', 'container', 'tubs', 'tub'], { unit: 'container', dimension: 'other', factor: 1 }],
  [['tubes', 'tube'], { unit: 'tube', dimension: 'other', factor: 1 }],
  [['bars', 'bar'], { unit: 'bar', dimension: 'other', factor: 1 }],
  [['splashes', 'splash'], { unit: 'splash', dimension: 'other', factor: 1 }],
  [['sprinkle'], { unit: 'sprinkle', dimension: 'other', factor: 1 }],
  [['drops', 'drop'], { unit: 'drop', dimension: 'other', factor: 1 }],
  [['recipes', 'recipe'], { unit: 'recipe', dimension: 'other', factor: 1 }],
  [['batches', 'batch'], { unit: 'batch', dimension: 'other', factor: 1 }]
];

const UNIT_LOOKUP = new Map<string, UnitDef>();
for (const [aliases, def] of UNIT_ALIASES) for (const alias of aliases) UNIT_LOOKUP.set(alias, def);

export function unitDef(unit: string): UnitDef | undefined {
  return UNIT_LOOKUP.get(unit);
}

/** Case matters only for T (tablespoon) vs t (teaspoon). */
function lookupUnit(token: string): UnitDef | undefined {
  if (token === 'T' || token === 't') return UNIT_LOOKUP.get(token);
  return UNIT_LOOKUP.get(token.toLowerCase());
}

const UNIT_PATTERN = [...UNIT_LOOKUP.keys()]
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&'))
  .join('|');
const UNIT_RE = new RegExp(`^(${UNIT_PATTERN})(?![a-z])\\.?\\s*`, 'i');

const VULGAR: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5',
  '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twelve: 12, half: 0.5
};

const NUM = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to|or)\s*(${NUM}))?\s*`);
/** "1 and 1/2", "1/4 + 1/8": a fraction added to the quantity before the unit. */
const AND_FRACTION_RE = /^(?:and|\+)\s*(\d+\/\d+)\s*/;
const SUM = String.raw`(?:${NUM})(?:\s*(?:and|\+)\s*\d+\/\d+)?`;
/** "60 ml / ¼ cup": the second, alternative measure of a dual measure. */
const ALT_MEASURE_RE = new RegExp(String.raw`^\/\s*(?:(?:heaped|heaping|packed|scant|generous|level|about|approx\.?|approximately|around|(?:just|a little|a bit) (?:under|over)|~)\s*)?(?:${SUM})(?:\s*(?:-|–|to)\s*(?:${NUM}))?\s*`, 'i');
/** "½ cup + 2 tbsp": a second amount added to the first. */
const PLUS_MEASURE_RE = new RegExp(String.raw`^(?:\+|plus\s|and\s)\s*(${NUM})(?:\s*(?:-|–|to|or)\s*(?:${NUM}))?\s*`, 'i');
/** "½ cup – 1 cup milk", "½ teaspoon to 2 teaspoons": the top of a range written with its own unit. */
const RANGE_TAIL_RE = new RegExp(String.raw`^(?:-|–|to)\s*(${NUM})\s*`, 'i');
/** "1/4 inch sliced carrots", "1/2-inch chunks of": the size of the cut, kept as a note. */
const CUT_SIZE_RE = new RegExp(String.raw`^((?:${NUM})(?:\s*(?:-|–|to)\s*(?:${NUM}))?\s*-?\s*(?:inch(?:es)?|in\.|cm|"|”)(?:\s+(?:wide|thick|long))?(?:\s+(?:chunks?|pieces?|cubes?|dice|slices?|rounds?))?)\s+(?:of\s+)?`, 'i');
/** "1 cup 180g rice", "2 tablespoons 30 ml water": a second measure written straight after the first. */
const SECOND_MEASURE_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–)\s*(?:${NUM}))?\s*(?:an?\s+)?`);
/** How full the spoon or cup is: says nothing about what to buy. */
const MEASURE_WORD = String.raw`heaped|heaping|packed|loosely|lightly|firmly|scant|generous|rounded|level|approx\.?|approximately|about|around`;
const MEASURE_WORDS_RE = new RegExp(`^(?:(?:${MEASURE_WORD})\\s+)+`, 'i');
const MEASURE_QUALIFIERS_RE = new RegExp(`\\b(?:${MEASURE_WORD})\\b`, 'gi');
/** "about 2 cups": an approximate amount, shown as such rather than dropped. */
const APPROX_RE = /\b(?:approx\.?|approximately|about|around)\b/i;
const FILL_QUALIFIERS_RE = /\b(?:heaped|heaping|packed|loosely|lightly|firmly|scant|generous|rounded|level)\b/gi;
/** "1 large handful": a size before a unit describes the unit, not the ingredient. */
const UNIT_SIZE_RE = /^(?:x-large|extra-large|large|medium|small|big|fat|good|healthy|hearty)\s+(?=(?:handfuls?|heads?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|splash(?:es)?|sprinkles?|cans?|tins?|jars?|blocks?|bags?|packages?|sprigs?|stalks?|slices?|pieces?|scoops?|cloves?)\b)/i;
/** "3-inch piece", "2 cm piece": the size of a piece, kept as a note. */
const PIECE_SIZE_RE = /^(\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?\s*-?\s*(?:inch|in\.|cm|"|”))\s*/i;
/** "1 15 oz can": the size of the can, jar or block, kept as a note. */
const PACK_SIZE_RE = /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*-?\s*(?:oz\.?|ounces?|g|grams?|ml|lbs?\.?|pounds?))\s*(?:[([][^)\]]*[)\]]\s*)?(?=(?:cans?|tins?|jars?|blocks?|bags?|packages?|packs?|packets?|cartons?|canned|box(?:es)?|bottles?|tubs?|containers?|tubes?|bars?)\b)/i;
/** "1 14 ounce artichoke hearts", "one 4oz butter stick": a count of packages whose size is the measure. */
const COUNT_SIZE_RE = /^(\d+(?:[.,]\d+)?)\s*-?\s*(?=(?:oz\.?|ounces?|g|grams?|ml|lbs?\.?|pounds?)(?![\p{L}]))/iu;
/** "water + 2 tablespoons", "soy milk + 1 tbsp for brushing": an extra amount at the end of the name. */
const TRAILING_EXTRA_RE = new RegExp(String.raw`\s+(?:\+|plus)\s*(?:(?:${NUM})\s*(?:${UNIT_PATTERN})\.?(?=\s+(?:for|to|as|if)\b|\s*[,;(]|\s*$))`, 'i');
/** "or 8 slices of", "and 1/4 teaspoon": the amount of a second ingredient inside the name. */
const ALT_AMOUNT_RE = new RegExp(String.raw`\s+or\s+(?:${NUM}).*$`, 'i');
const SIZE_WORD = 'x-large|extra-large|large|medium|small|big';
/** "2 small or 1 large peppers": the first size goes with the amount. */
const ALT_SIZE_RE = new RegExp(String.raw`^(${SIZE_WORD})\s+or\s+(?:(?:${NUM})\s+)?(?:${SIZE_WORD})\s+`, 'i');
/** "Garnish: chopped parsley", "spices: 1 tsp cumin": a label naming one ingredient. */
const OPTIONAL_LABEL_RE = /optio|garnish|topping|serv|add|extra|mix-in|decorat/i;
const LABEL_RE = /^((?:optional\s+|optioanl\s+)?[\p{L}][\p{L}&' -]{0,30}?)\s*:\s*(?=\S)/iu;

/** Cached parsed lines also need to retain qualifiers removed from their measure; an approximate amount is kept as `approx`. */
export function hasDroppedMeasureWords(p: ParsedIngredient): boolean {
  const words = p.approx ? FILL_QUALIFIERS_RE : MEASURE_QUALIFIERS_RE;
  const count = (text: string) => [...text.matchAll(words)].length;
  // Words in a note ("about 2.5 pounds") stay in the note; only those before the name were dropped.
  const kept = p.afterMeasure ?? (p.phrase !== undefined ? `${p.phrase} ${p.note}` : '');
  return count(p.raw) > count(kept);
}

function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

export interface PreparationTerm {
  id: string;
  /** The words as written. */
  text: string;
  /** Written inside the name ("chopped scallion"), not in a note: other languages attach it to the noun. */
  inName?: true;
}

export interface ParsedIngredient {
  /** English name of a mapped concept, used only with the existing density table. */
  densityName?: string;
  /** False when mapping discarded source wording that display must retain. Absent in older datasets. */
  conceptExact?: boolean;
  /** The ingredient as written, without amount, notes or commentary. Absent in older datasets. */
  phrase?: string;
  /** Preparation terms in line order. Notes that are not terms are commentary and never displayed. */
  terms?: PreparationTerm[];
  /** "1 (15 oz) can": the size of each can, block or piece. */
  size?: { quantity: number; unit: string } | null;
  /** "salt and pepper", "walnuts or almonds": the second ingredient, when both sides are known exactly. */
  also?: { concept: string; name: string; joiner: 'and' | 'or' } | null;
  /** "about 2 cups". */
  approx?: true;
  /** Not an ingredient: a heading ("For the sauce:") or anything else (equipment, instructions, notes). */
  kind?: 'heading' | 'other';
  concept: string | null;
  raw: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** Metric weight or volume from a parenthetical like "(240 g)" or a dual measure like "1 cup / 240 ml". */
  metric: { quantity: number; unit: 'g' | 'ml' } | null;
  /** When the line has a unit: the text after its amount, unit and any metric equivalent ("flour, sifted"). */
  afterMeasure: string | null;
  /** Canonical, singular, lowercase name used for matching and aggregation. */
  name: string;
  note: string;
  optional: boolean;
}

/** Normalize unicode fractions and stray punctuation so the regexes see plain text. */
export function normalizeLine(raw: string): string {
  let s = cleanText(raw);
  s = s.replace(/(\d)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, d: string, f: string) => `${d} ${VULGAR[f]}`);
  s = s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (f) => VULGAR[f] ?? f);
  s = s.replace(/⁄/g, '/');
  // "3 /4 teaspoon": a fraction split by a stray space.
  s = s.replace(/(\d) \/(\d)/g, '$1/$2');
  // "14- oz . can", "1 12-ounce) bag": a stray space or a missing bracket in the measure.
  s = s.replace(/\b(oz|lbs?|tsp|tbsp|c)\s+\.(?=\s)/gi, '$1.').replace(/^(\d+) (\d[\d.]*\s*-?\s*(?:ounces?|oz|grams?|g|ml|lbs?|pounds?)\.?)\)/i, '$1 ($2)');
  s = s.replace(/\(\(/g, '(').replace(/\)\)/g, ')');
  s = s.replace(/\*+/g, '');
  // Invisible separators, inch marks ("1/2” ginger"), a lone "|" and a full stop after the name ("baking powder.").
  s = s.replace(/[\u200b-\u200d\u2060-\u2064\u2800\ufeff]/g, '').replace(/^([\d\s\/.–-]*\d)\s*[”″](?=\s*\p{L})/u, '$1 inch ');
  s = s.replace(/(\d\/\d+)\.(?=\s)/g, '$1').replace(/\s\|(?=\s|$)/g, ' ').replace(/(\p{L}{3})\.(?=\s*(?:\(|$))/gu, '$1');
  s = s.replace(/^[-•▢·\s]+/, '');
  return s.replace(/\s+/g, ' ').trim();
}

/** "(280g)", "(packed – 150g)": a metric amount closing a parenthetical whose words carry no other number. */
const LATE_METRIC_RE = /\(([^()\d]{0,30}?)[\s,;:–—-]*(?:~|about\s+)?(\d+(?:[.,]\d+)?\s*(?:g|grams?|kg|ml|mL|milliliters?|l|liters?))\s*\)/i;
const METRIC_RE = /(\d+(?:[.,]\d+)?)\s*(g|grams?|kg|ml|mL|milliliters?|l|liters?)\b/i;

function extractMetric(text: string): ParsedIngredient['metric'] {
  const m = text.match(METRIC_RE);
  if (!m) return null;
  const q = Number(m[1]!.replace(',', '.'));
  const u = m[2]!.toLowerCase();
  if (u === 'kg') return { quantity: q * 1000, unit: 'g' };
  if (u === 'l' || u.startsWith('liter')) return { quantity: q * 1000, unit: 'ml' };
  if (u.startsWith('g')) return { quantity: q, unit: 'g' };
  return { quantity: q, unit: 'ml' };
}

/** Words that describe preparation or size, not what to buy. */
const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'chopped', 'finely', 'roughly', 'coarsely', 'thinly', 'minced', 'diced', 'sliced',
  'grated', 'shredded', 'crushed', 'peeled', 'large', 'small', 'medium', 'medium-sized', 'big', 'heaping',
  'heaped', 'level', 'packed', 'loosely', 'lightly', 'firmly', 'raw', 'organic', 'cooked', 'uncooked', 'dried',
  'ripe', 'very', 'cold', 'warm', 'hot', 'boiling', 'room', 'temperature', 'softened', 'melted', 'cubed',
  'halved', 'quartered', 'trimmed', 'rinsed', 'drained', 'washed', 'pitted', 'seeded', 'cored', 'toasted',
  'roasted', 'frozen', 'thawed', 'good', 'quality', 'good-quality', 'about', 'approx', 'approximately', 'plus',
  'more', 'extra', 'pure', 'unsweetened', 'sweetened', 'unsalted', 'salted', 'store-bought', 'homemade',
  'optional', 'divided', 'generous', 'scant', 'whole', 'canned', 'jarred', 'of', 'the', 'your', 'favorite',
  'favourite', 'choice', 'baby', 'mild', 'fine', 'coarse', 'flaky', 'kosher', 'sea', 'pinkish', 'himalayan',
  'mellow', 'ground', 'cracked', 'freshly-ground', 'firm', 'extra-firm', 'super-firm', 'silken', 'virgin',
  'extra-virgin', 'light', 'lite', 'full-fat', 'reduced', 'low-sodium', 'sodium', 'low', 'no-salt-added',
  'smooth', 'creamy', 'natural', 'runny', 'regular', 'plain', 'strong', 'brewed', 'filtered', 'tap', 'and', 'or',
  'some', 'few', 'handful', 'bunch', 'container', 'pack', 'heaping', 'rounded', 'dry', 'sprinkle', 'for', 'dark',
  'piece', 'pieces', 'x-large', 'extra-large', 'xl', 'jumbo'
]);

/** Plural or alternate names → canonical shopping names. Keys are post-singularization. */
const SYNONYMS: Record<string, string> = {
  scallion: 'green onion',
  'spring onion': 'green onion',
  'garbanzo bean': 'chickpea',
  'garbanzo': 'chickpea',
  'coriander leaf': 'cilantro',
  'fresh coriander': 'cilantro',
  'nutritional yeast flake': 'nutritional yeast',
  nooch: 'nutritional yeast',
  'olive oil extra': 'olive oil',
  'evoo': 'olive oil',
  'vegetable stock': 'vegetable broth',
  'veggie broth': 'vegetable broth',
  'veggie stock': 'vegetable broth',
  'black pepper': 'black pepper',
  pepper: 'black pepper',
  'salt and pepper': 'salt',
  'salt & pepper': 'salt',
  'salt to taste': 'salt',
  'confectioners sugar': 'powdered sugar',
  "confectioners' sugar": 'powdered sugar',
  'icing sugar': 'powdered sugar',
  'caster sugar': 'sugar',
  'granulated sugar': 'sugar',
  'cane sugar': 'sugar',
  'white sugar': 'sugar',
  'organic cane sugar': 'sugar',
  'all-purpose flour': 'all-purpose flour',
  'all purpose flour': 'all-purpose flour',
  'plain flour': 'all-purpose flour',
  'ap flour': 'all-purpose flour',
  'plant milk': 'plant milk',
  'non-dairy milk': 'plant milk',
  'nondairy milk': 'plant milk',
  'dairy-free milk': 'plant milk',
  'vegan milk': 'plant milk',
  'plant-based milk': 'plant milk',
  'milk': 'plant milk',
  'soymilk': 'soy milk',
  'aubergine': 'eggplant',
  'courgette': 'zucchini',
  'capsicum': 'bell pepper',
  'red bell pepper': 'bell pepper',
  'green bell pepper': 'bell pepper',
  'yellow bell pepper': 'bell pepper',
  'orange bell pepper': 'bell pepper',
  'red pepper': 'bell pepper',
  'tamari': 'soy sauce',
  'shoyu': 'soy sauce',
  'garlic clove': 'garlic',
  'clove garlic': 'garlic',
  'clove of garlic': 'garlic',
  'garlic cloves': 'garlic',
  'lemon, juiced': 'lemon',
  'lemon juice': 'lemon juice',
  'lime juice': 'lime juice',
  'water': 'water',
  'ice': 'ice',
  'tofu': 'tofu'
};

const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mangoes: 'mango',
  avocados: 'avocado',
  chilies: 'chili',
  chillies: 'chili',
  chiles: 'chili',
  molasses: 'molasses',
  hummus: 'hummus',
  couscous: 'couscous',
  asparagus: 'asparagus',
  citrus: 'citrus',
  oats: 'oats',
  greens: 'greens',
  peas: 'pea',
  lentils: 'lentil',
  chickpeas: 'chickpea',
  noodles: 'noodle',
  'brussels': 'brussels',
  grits: 'grits',
  sprinkles: 'sprinkles',
  chips: 'chip',
  flakes: 'flakes',
  seeds: 'seed',
  nuts: 'nut'
};

export function singularize(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
  if (word.length <= 3) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Reduce an ingredient phrase to what you would put on a shopping list. */
export function canonicalName(phrase: string): string {
  const segments = phrase.toLowerCase().replace(/\([^)]*\)?/g, ' ').split(/,|;|\s[-–—]\s|:/);
  const first = reduceSegment(segments[0] ?? '');
  // "plain, unsweetened non-dairy milk": the first segment only described the second.
  if (!first && segments[1] && isOnlyDescriptors(segments[0]!)) return reduceSegment(segments[1]);
  return first;
}

function isOnlyDescriptors(segment: string): boolean {
  const words = segment.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => DESCRIPTORS.has(w) && w !== 'optional' && w !== 'for');
}

function reduceSegment(segment: string): string {
  // Alternatives: keep the first that names something ("tapioca flour or cornstarch" → "tapioca flour"),
  // or the last when the first only describes it ("fresh or frozen peas" → "peas").
  const alternatives = segment.split(/\s(?:or|\/)\s/);
  const named = reduceAlternative(alternatives[0]!);
  return named || (alternatives.length > 1 ? reduceAlternative(alternatives.at(-1)!) : '');
}

function reduceAlternative(text: string): string {
  let s = text;
  s = s.replace(/\b(to taste|as needed|for (?:serving|garnish|topping|frying|the pan|greasing|drizzling)|if needed|optional)\b.*$/, '');
  s = s.replace(/[^\p{L}\p{N}&'\- ]/gu, ' ');
  const kept = s.split(/\s+/).filter((w) => w && !DESCRIPTORS.has(w) && !/^\d/.test(w));
  let name = kept.join(' ').trim();
  const direct = SYNONYMS[name];
  if (direct) return direct;
  const words = name.split(' ');
  if (words.length > 0) words[words.length - 1] = singularize(words[words.length - 1]!);
  name = words.join(' ');
  return SYNONYMS[name] ?? name;
}

/** Parse one published ingredient line into quantity, unit and canonical name. */
export function parseIngredient(raw: string, lookup: IngredientLookup = {}, language = 'en'): ParsedIngredient {
  const pack = languagePacks[language];
  if (!pack) throw new RangeError(`Unsupported content language: ${language}`);
  let s = normalizeLine(raw).replace(/^\.(?=\d)/, '0.');
  const optional = (pack.optional ?? /\boptional\b/i).test(s);
  const label = language === 'en' ? s.match(LABEL_RE) : null;
  // Only a label naming one known ingredient is dropped; a list after it ("Garnish: parsley, lemon") stays as written.
  if (label && !/[,;(]/.test(s.slice(label[0].length))) {
    const inner = parseIngredient(s.slice(label[0].length), lookup, language);
    // "Toppings: basil" is shown as optional basil.
    const optionalId = OPTIONAL_LABEL_RE.test(label[1]!) ? lookupTerm('optional', lookup) : null;
    const terms = optionalId && !inner.terms?.some((t) => t.id === optionalId) ? [...inner.terms ?? [], { id: optionalId, text: 'optional' }] : inner.terms;
    if (inner.concept && inner.conceptExact) return { ...inner, terms, raw: cleanText(raw), optional: inner.optional || !!optionalId };
  }
  let approx = false;
  // Words this parser now reads as amount or commentary but an older one left in the name ("can crushed tomatoes",
  // "fresh or 1/2 dried thyme"): the vocabulary learned names in that shape, so they are tried too.
  let written = '';
  const stripMeasureWords = (input: string) => {
    let text = input;
    // "~1/3 cup".
    const tilde = text.match(/^~\s*/);
    if (tilde) {
      approx = true;
      text = text.slice(tilde[0].length);
    }
    // "circa 1 litro d'acqua".
    const circa = language === 'it' ? text.match(/^circa\s+(?=\d|un[oa']?\s|mezz[oa]\s)/i) : null;
    if (circa) {
      approx = true;
      text = text.slice(circa[0].length);
    }
    const m = text.match(MEASURE_WORDS_RE);
    if (m && APPROX_RE.test(m[0])) approx = true;
    return m ? text.slice(m[0].length) : text;
  };
  // Preparation written before the line ("Juice of 1 lemon", "Optional: …", "more hot sauce") moves to its notes.
  const leading: string[] = [];
  const lead = s.match(/^(?:(juice|zest)(?:\s+and\s+(juice|zest))?\s+(?:of|from)\s+(?:the\s+)?|\(?(optional)\)?[:\s]\s*|(more|additional)\s+)/i);
  if (lead && language === 'en') {
    s = s.slice(lead[0].length);
    if (lead[1]) leading.push(...[lead[1], lead[2]].filter(Boolean).map((w) => (w!.toLowerCase() === 'juice' ? 'juiced' : 'zested')));
    else leading.push(lead[3] ? 'optional' : 'as needed');
  }
  s = s.replace(/^\((\d+)\)\s*/, '$1 ');
  s = stripMeasureWords(s);
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: string | null = null;
  let altMeasure = '';

  const words = pack.numberWords ?? NUMBER_WORDS;
  const word = s.match(new RegExp(`^(${Object.keys(words).join('|')})\\s+`, 'i'));
  const q = s.match(QTY_RE);
  if (q) {
    quantity = parseNumber(q[1]!);
    quantityMax = q[2] ? parseNumber(q[2]) : null;
    s = s.slice(q[0].length);
    const more = s.match(AND_FRACTION_RE);
    if (more) {
      quantity += parseNumber(more[1]!);
      s = s.slice(more[0].length);
    }
    // "1-inch piece", "6- ounces": the hyphen joined the number to its unit.
    s = s.replace(/^[-–]\s*(?=[\p{L}"”])/u, (m) => { written += m; return ''; });
  } else if (word) {
    quantity = words[word[1]!.toLowerCase()] ?? null;
    s = s.slice(word[0].length);
    // "a generous ¾ cup": the article only introduced the amount.
    const amount = /^an?$/i.test(word[1]!) ? stripMeasureWords(s).match(QTY_RE) : null;
    if (amount) {
      quantity = parseNumber(amount[1]!);
      quantityMax = amount[2] ? parseNumber(amount[2]) : null;
      s = stripMeasureWords(s).slice(amount[0].length);
    }
  }
  // "half a lemon", "1/2 a lemon".
  if (quantity !== null && language === 'en') s = s.replace(/^(?:an?|the)\s+(?=\p{L})/iu, '');
  // "a few basil leaves", "a few drops of rum extract": no amount, to taste.
  const few = language === 'en' && (quantity === null || quantity === 1) && quantityMax === null ? s.match(/^few\s+/i) : null;
  if (few) {
    written += few[0];
    s = s.slice(few[0].length);
    const fewUnit = s.match(UNIT_RE);
    // "a few cloves" names the cloves; "a few cloves of garlic" measures the garlic.
    if (fewUnit && lookupUnit(fewUnit[1]!)?.dimension === 'other' && /^(?:of\s+)?\p{L}/iu.test(s.slice(fewUnit[0].length))) {
      const of = s.slice(fewUnit[0].length).match(/^of\s+/i)?.[0] ?? '';
      written += fewUnit[0] + of;
      s = s.slice(fewUnit[0].length + of.length);
    }
    quantity = null;
    leading.push('to taste');
  }
  // "70% dark chocolate": the percentage is detail, kept in the original.
  if (language === 'en') s = s.replace(/\b\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*%\s*/, '');

  // "1 (15-ounce) can chickpeas": the parenthetical size belongs to the can.
  let sizeNote = '';
  s = stripMeasureWords(s).replace(UNIT_SIZE_RE, '');
  // "2 x 400 g / 14 oz canned tomatoes": a count of packages of a stated size.
  const times = quantity !== null ? s.match(/^x\s*(\d+(?:[.,]\d+)?\s*(?:g|ml|oz|ounces?))(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:g|ml|oz|ounces?))?\s+/i) : null;
  if (times) {
    sizeNote = times[1]!;
    s = s.slice(times[0].length);
  }
  // A unit word reads as a unit after an amount; "Pizzico di sale" alone still means one pinch, "Foglioline di menta" is the name.
  if (pack.units) s = s.replace(languageUnitPatterns[language]!, (all, token: string) => (quantity !== null || pack.units![token.toLowerCase()] === 'pinch' ? `${pack.units![token.toLowerCase()]} ` : all));
  const size = times ? null : s.match(/^\(([^)]*)\)\s*/) ?? s.match(PIECE_SIZE_RE) ?? s.match(PACK_SIZE_RE);
  if (size) {
    sizeNote = size[1]!;
    s = s.slice(size[0].length);
  }
  const counted = !size && !times && quantity !== null && quantityMax === null && language === 'en' ? s.match(COUNT_SIZE_RE) : null;
  if (counted) {
    quantity! *= parseNumber(counted[1]!);
    s = s.slice(counted[0].length);
  }

  const u = s.match(UNIT_RE);
  if (u && quantity !== null) {
    const def = lookupUnit(u[1]!);
    if (def) {
      unit = def.unit;
      if (def.dimension === 'other') written += u[0];
      s = s.slice(u[0].length);
      // "1 cucchiaino colmo di curry", "1 cucchiaio a testa di anacardi": how full, or per person, is a note.
      const fill = language === 'it' ? s.match(/^(colm[oaie]|abbondant[ei]|ras[oaie]|scars[oaie]|grand[ei]|piccol[oaie]|a testa)\s+/i) : null;
      if (fill) {
        leading.push(fill[1]!.toLowerCase());
        s = s.slice(fill[0].length);
      }
      // "10 ounce package spinach": the weight is the size of the package.
      const container = (def.dimension === 'mass' || def.dimension === 'volume') && quantityMax === null && !altMeasure && language === 'en'
        ? s.match(/^(?:cans?|tins?|jars?|blocks?|bags?|packages?|packs?|packets?|cartons?|box(?:es)?|bottles?|tubs?|containers?|tubes?)\b\s*(?:of\s+)?/i) : null;
      if (container) {
        sizeNote ||= `${quantity} ${def.unit}`;
        unit = lookupUnit(container[0].trim().split(/\s/)[0]!)!.unit;
        quantity = 1;
        written += container[0];
        s = s.slice(container[0].length);
      }
      const range = s.match(RANGE_TAIL_RE);
      const rangeUnit = range ? s.slice(range[0].length).match(UNIT_RE) : null;
      const rangeDef = rangeUnit ? lookupUnit(rangeUnit[1]!) : undefined;
      if (range && rangeDef && (rangeDef.unit === def.unit || (rangeDef.dimension === def.dimension && def.dimension !== 'other'))) {
        quantityMax = (parseNumber(range[1]!) * rangeDef.factor) / def.factor;
        s = s.slice(range[0].length + rangeUnit![0].length);
      }
      const alt = skipAltMeasure(s, def.dimension === 'mass' || def.dimension === 'volume');
      altMeasure = s.slice(0, s.length - alt.length);
      s = alt;
      // "3/4 cup (180 ml) + 2 tablespoons": the bracket belongs to the first amount.
      const bracket = s.match(/^\(([^()]*)\)\s*(?=(?:\+|plus\s))/i);
      if (bracket) {
        altMeasure ||= bracket[1]!;
        s = s.slice(bracket[0].length);
      }
      const plus = s.match(PLUS_MEASURE_RE);
      const plusUnit = plus ? s.slice(plus[0].length).match(UNIT_RE) : null;
      const plusDef = plusUnit ? lookupUnit(plusUnit[1]!) : undefined;
      if (plus && plusUnit && plusDef) {
        // Only same-dimension amounts add up; anything else is dropped rather than misread as the name.
        if (plusDef.dimension === def.dimension && def.dimension !== 'other') {
          const extra = (parseNumber(plus[1]!) * plusDef.factor) / def.factor;
          quantity += extra;
          if (quantityMax !== null) quantityMax += extra;
        }
        s = s.slice(plus[0].length + plusUnit[0].length);
        // "¼ cup + 2 tbsp / 90 ml".
        s = skipAltMeasure(s, false);
      }
      // "1 cup 180g rice": the second measure repeats the first; grams or ml are kept as its metric.
      const second = s.match(SECOND_MEASURE_RE);
      const secondUnit = second ? s.slice(second[0].length).match(UNIT_RE) : null;
      if (second && secondUnit && lookupUnit(secondUnit[1]!)) {
        altMeasure ||= s.slice(0, second[0].length + secondUnit[0].length);
        s = skipAltMeasure(s.slice(second[0].length + secondUnit[0].length), false);
      }
    }
  } else if (!u && quantity !== null && /^\/\s/.test(s)) {
    // "30-45 / 2-3 tbsp oil": the first amount has no unit, so the second measure is the one kept.
    const alt = s.match(new RegExp(String.raw`^\/\s*(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*`));
    const altUnit = alt ? s.slice(alt[0].length).match(UNIT_RE) : null;
    const altDef = altUnit ? lookupUnit(altUnit[1]!) : undefined;
    if (alt && altUnit && altDef) {
      quantity = parseNumber(alt[1]!);
      quantityMax = alt[2] ? parseNumber(alt[2]) : null;
      unit = altDef.unit;
      s = s.slice(alt[0].length + altUnit[0].length);
    }
  } else if (u && /^(pinch|dash|handful|splash|sprinkle|bunch|sprig|can|tin|jar|bag|package|block|packet|sachet)/i.test(u[1]!)) {
    unit = lookupUnit(u[1]!)?.unit ?? null;
    quantity = 1;
    written += u[0];
    s = s.slice(u[0].length);
  }

  // "pinch or two of", "1/2 teaspoon or so of".
  const orSo = unit && language === 'en' ? s.match(/^or\s+(?:two|so)\b\s*(?:of\s+)?/i) : null;
  if (orSo) {
    approx = true;
    s = s.slice(orSo[0].length);
  }

  // "garlic cloves" written name-first.
  // The clove becomes the unit and the name keeps only the garlic, as "3 large cloves garlic" does.
  const nameFirstClove = !unit && quantity !== null ? s.match(/^(?:(?:x-large|extra-large|large|medium|small|big|fat)\s+)?(garlic) cloves?\b/i) : null;
  if (nameFirstClove) {
    unit = 'clove';
    s = nameFirstClove[1]! + s.slice(nameFirstClove[0].length);
  }

  const paren = s.match(/^\(([^)]*)\)\s*/);
  const parenMetric = paren ? extractMetric(paren[1]!) : null;
  const metricSource = altMeasure || (unit && ['cup', 'tbsp', 'tsp', 'oz', 'lb'].includes(unit) ? sizeNote : '');
  let metric = parenMetric ?? (metricSource ? extractMetric(metricSource) : null);
  let afterMeasure = unit ? (parenMetric ? s.slice(paren![0].length) : s) : null;
  // "2 cups flour (280g)": a parenthetical that is only a metric amount, after the name.
  const dim = unit ? unitDef(unit)?.dimension : undefined;
  const lateMetric = !metric && afterMeasure && (dim === 'volume' || dim === 'mass') ? afterMeasure.match(LATE_METRIC_RE) : null;
  if (lateMetric) {
    metric = extractMetric(lateMetric[2]!);
    const words = lateMetric[1]!.replace(/^\s*(?:about|approx\.?|~)?\s*$/i, '').trim();
    afterMeasure = afterMeasure!.replace(lateMetric[0], words ? `(${words})` : ' ').replace(/\s+([,)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }
  if (unit && (unit === 'g' || unit === 'kg') && quantity !== null)
    metric = { quantity: quantity * (unit === 'kg' ? 1000 : 1), unit: 'g' };
  if (unit && (unit === 'ml' || unit === 'l') && quantity !== null)
    metric = { quantity: quantity * (unit === 'l' ? 1000 : 1), unit: 'ml' };

  s = s.replace(/^\([^)]*\)\s*/, '').replace(/^of\s+(?:an?\s+)?/i, (m) => { if (written) written += m; return ''; });
  const cut = unit && language === 'en' ? s.match(CUT_SIZE_RE) : null;
  if (cut) s = s.slice(cut[0].length);
  // "2-inch piece of ginger": the piece is the measure.
  if (unit && ['inch', 'cm'].includes(unit) && language === 'en') s = s.replace(/^(?:pieces?|knobs?|chunks?|slices?)\s+(?:of\s+)?(?=\p{L})/iu, (m) => { written += m; return ''; });
  // "1 package of 4 sausages": the count inside the package.
  if (unit && ['package', 'bag', 'box', 'can', 'jar', 'container'].includes(unit) && language === 'en') s = s.replace(/^\d+\s+(?=\p{L})/u, '');
  if (pack.preposition) s = s.replace(pack.preposition, '');
  // "½ tsp each salt & pepper", "1/3 tsp or more cumin": amounts shared or open-ended.
  s = s.replace(/^each\s+(?:of\s+)?/i, '');
  const more = language === 'en' ? s.match(/^(?:or|plus|\+)\s+more\s+/i) : null;
  if (more) {
    s = s.slice(more[0].length);
    leading.push('as needed');
  }
  // "water + 2 tablespoons": an extra amount of the same ingredient goes to the notes.
  if (language === 'en') s = s.replace(TRAILING_EXTRA_RE, (m) => `, ${m.replace(/^\s*(?:\+|plus)\s*/i, '')}`);
  // "plain, unsweetened non-dairy milk", "medium (113g) onion": words that only describe continue with the name.
  const head = s.match(/^([^,;(]+?)\s*(?:,\s*|\(([^()]*)\)\s*)(?=[\p{L}])/u);
  if (head && onlyTerms(head[1]!, lookup) && !lookupConcept(head[1]!, lookup)) s = `${head[1]} ${s.slice(head[0].length)}${head[2] ? ` (${head[2]})` : ''}`;
  const commaAt = s.search(/[,;(]/);
  const afterName = commaAt >= 0 ? s.slice(commaAt) : '';
  let note = [sizeNote, cut?.[1], afterName].filter(Boolean).join(' ').replace(/^[,;\s]+/, '');
  // "seeds of choice", "toppings such as tomato": the choice is commentary.
  let phrase = s.split(/[,;(]/)[0]!.trim().replace(/\s+(?:of (?:your )?choice|such as\b.*)$/i, '').replace(/^(?:your\s+)?favou?rite\s+/i, '');
  // "4 small or 3 large bananas", "buns or 8 slices of bread": the amount of an alternative is dropped with it.
  // An alternative with an amount of its own is commentary: shown under the first amount, it would be wrong.
  const uncut = phrase;
  if (language === 'en') phrase = phrase.replace(ALT_SIZE_RE, '$1 ').replace(ALT_AMOUNT_RE, '');
  let preparation = [afterName, ...leading].join(', ');
  const trailing = !lookupConcept(phrase, lookup) && pack.trailingNote ? phrase.match(pack.trailingNote) : null;
  if (trailing) {
    phrase = phrase.slice(0, trailing.index);
    note = [trailing[1], note].filter(Boolean).join(', ');
    preparation = [trailing[1], preparation].filter(Boolean).join(', ');
  }
  const name = pack.nonIngredient?.test(s) ? '' : language === 'en' ? canonicalName(s) : phrase.trim().toLowerCase();
  // "romano or ramiro pepper": a one-word first option shares the noun when that names a known ingredient.
  const shared = phrase.match(/^\s*([\p{L}'-]+)\s+or\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)*\s+([\p{L}'-]+)\s*$/iu);
  // Qualifiers in notes or unknown names must never disappear through canonicalization.
  // "butter (vegan)": the qualifier is outside an animal name, so the name alone must not map to butter.
  const qualifierOutsideName = isQualifiedIngredient(raw) && !isQualifiedIngredient(phrase)
    && Object.keys(languagePacks).some((l) => findUnsafeRenderedTerms(phrase, l).length > 0);
  const legacy = `${written}${uncut}`.trim();
  // "can white beans" names the canned product: a name with its container comes before the name alone.
  // Every tail of the dropped words is tried ("inch piece cinnamon", "piece cinnamon").
  const tails = written.split(/(?<=\s)/).map((_, i, parts) => parts.slice(i).join(''));
  const asWritten = [...new Set(tails.flatMap((t) => [`${t}${uncut}`, `${t}${phrase}`]))].map((t) => lookupConcept(t.trim(), lookup)).find(Boolean)
    ?? (uncut !== phrase ? lookupConcept(uncut.trim(), lookup) : null);
  let concept = qualifierOutsideName ? null : isQualifiedIngredient(phrase)
    ? (written ? asWritten : null) ?? lookupConcept(phrase, lookup) ?? asWritten
    : (written ? asWritten : null) ?? lookupConcept(phrase, lookup) ?? asWritten ?? (shared && lookupConcept(canonicalName(`${shared[1]} ${shared[2]}`), lookup)) ?? lookupConcept(name, lookup);
  phrase = phrase.trim();
  let conceptExact = !!concept && (lookupConcept(phrase, lookup) === concept || asWritten === concept);
  const terms: PreparationTerm[] = [];
  let also: ParsedIngredient['also'] = null;
  if (!conceptExact && !qualifierOutsideName) {
    // "romano or ramiro pepper" shares its noun and is never split into two ingredients.
    const resolve = (text: string): Resolved | null => {
      const id = resolveName(text, lookup, language);
      if (id) return { concept: id, also: null };
      const split = splitIngredients(text, lookup, language);
      if (split || language !== 'en') return split;
      // "basil and/or mint".
      const andOr = text.replace(/\s*\band\s*\/\s*or\b\s*/gi, ' or ');
      if (andOr !== text) return splitIngredients(andOr, lookup, language);
      // "lime/lemon juice", "nuts/seeds": either word stands in its place; one the vocabulary does not know is a substitution.
      const slash = text.match(/([\p{L}'-]+)\/([\p{L}'-]+)/u);
      if (!slash) return null;
      const variant = (word: string) => `${text.slice(0, slash.index)}${word}${text.slice(slash.index! + slash[0].length)}`;
      const [a, b] = [variant(slash[1]!), variant(slash[2]!)];
      const [left, right] = [resolve(a), resolve(b)];
      if (left && right && left.concept !== right.concept && !left.also && !right.also)
        return { ...left, phrase: a, also: { concept: right.concept, name: canonicalName(b), joiner: 'or' as const } };
      return left ? { ...left, phrase: left.phrase ?? a } : right ? { ...right, phrase: right.phrase ?? b } : null;
    };
    const found = peelTerms(phrase, resolve, lookup, language) ?? (legacy !== phrase ? peelTerms(legacy, resolve, lookup, language) : null);
    if (found) {
      ({ concept, also } = found);
      if (found.phrase) phrase = found.phrase;
      terms.push(...[...found.terms, ...found.sideTerms ?? []].map((t): PreparationTerm => ({ ...t, inName: true })));
      conceptExact = true;
    }
  }
  terms.push(...noteTerms(preparation, lookup).filter((t) => !terms.some((other) => other.id === t.id)));
  const sizeDef = unit ? unitDef(unit) : undefined;
  const measuredSize = sizeNote && (!sizeDef || sizeDef.dimension === 'other') ? parseSize(sizeNote) : null;
  const kind = lineKind(cleanText(raw), quantity, concept, name);
  return { conceptExact, phrase, terms, size: measuredSize, also, ...(approx ? { approx: true as const } : {}), ...(kind ? { kind } : {}),
    raw: cleanText(raw), quantity, quantityMax, unit, metric, afterMeasure, name: kind ? '' : name, concept: kind ? null : concept, note, optional };
}

/** A raw line as shipped: one ingredient, or its parts when the line names several with their own amounts. */
export type ParsedLine = ParsedIngredient | ParsedIngredient[];

/** The parts of a shipped line; datasets before parts hold one object per line. */
export const lineParts = (line: ParsedLine): ParsedIngredient[] => (Array.isArray(line) ? line : [line]);

/** Words besides "+", "&" and the language's "and" that join two measured ingredients. */
const PART_JOINERS: Record<string, string[]> = { en: ['plus', 'mixed with', 'whisked with', 'combined with'], it: ['più'] };
/** "zest of 1 lemon + 2 tbsp juice": a later part named only by what it takes from an earlier one. */
const BACK_REFERENCE = /^(?:juice|zest|sauce|brine|liquid|pulp|succo|scorza|salsa|sugo|liquido|polpa|salamoia)$/i;
/** "1 tsp each cumin, turmeric…": a part sharing its amount with a list that the part would drop. */
const SHARED_AMOUNT = /(?<!\p{L})(?:each|ciascun[oa]|ognuno)(?!\p{L})/iu;
/** "each" right after the amount, followed by a list; "(15 oz each)" sizing a package was taken out first. */
const SHARED_LIST = /^[^,(]*?(?<!\p{L})(?:each|ciascun[oa]|ognuno)(?!\p{L}).*?(?:[,&+(]|\s(?:and|e)\s)/iu;

/**
 * "2 tsp cornstarch + 2 tbsp water": a line naming several ingredients, each with its own amount, as its parts.
 * It splits only where every part is a known ingredient and each later part has its own amount; any other
 * line is one part, as parseIngredient reads it. A joiner inside brackets or after an alternative
 * ("tamari or 1 tsp miso + 2 tbsp water") never splits, and a label ("Smoky: …") applies to every part.
 */
export function parseLine(raw: string, lookup: IngredientLookup = {}, language = 'en'): ParsedIngredient[] {
  const pack = languagePacks[language];
  if (!pack) throw new RangeError(`Unsupported content language: ${language}`);
  const s = normalizeLine(raw);
  const label = language === 'en' ? s.match(LABEL_RE)?.[0] ?? '' : '';
  const body = s.slice(label.length);
  const words = [pack.and, ...(PART_JOINERS[language] ?? [])].map((w) => w.replace(/ /g, String.raw`\s+`));
  const joiner = new RegExp(String.raw`(?:\s*,)?\s*(?:\+|&|(?<!\p{L})(?:${words.join('|')})(?!\p{L}))\s*(?=\d)`, 'iuy');
  const points: [start: number, end: number][] = [];
  for (let i = 0, depth = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth = Math.max(depth - 1, 0);
    else if (depth === 0) {
      joiner.lastIndex = i;
      if (joiner.exec(body) && joiner.lastIndex > i) {
        points.push([i, joiner.lastIndex]);
        i = joiner.lastIndex - 1;
      }
    }
  }
  const shared = sharedAmountParts(body, label, lookup, language);
  if (shared) return shared;
  if (!points.length) return [whole(raw, lookup, language)];
  const alternative = new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu');
  const known = (p: ParsedIngredient) => !p.kind && !!p.concept && p.conceptExact === true;
  // A later part needs its own amount and its own name: "3 large cloves" after a head of garlic is not the spice.
  const own = (p: ParsedIngredient) => p.quantity !== null && !!p.phrase && !BACK_REFERENCE.test(p.name);
  const part = (text: string) => parseIngredient(`${label}${text}`, lookup, language);
  // The parts of body[from…], splitting at points[k…]; null when no split makes every part known.
  const split = (from: number, k: number): ParsedIngredient[] | null => {
    for (let j = k; j < points.length; j++) {
      const [start, end] = points[j]!;
      const text = body.slice(from, start);
      if (alternative.test(text.replace(/\([^)]*\)?/g, ' ')) || SHARED_AMOUNT.test(text)) break;
      const p = part(text);
      if (!known(p) || (from > 0 && !own(p))) continue;
      const rest = split(end, j + 1);
      if (rest) return [p, ...rest];
    }
    if (from === 0) return null;
    const last = part(body.slice(from));
    return known(last) && own(last) && !SHARED_AMOUNT.test(body.slice(from)) ? [last] : null;
  };
  return split(0, 0) ?? [whole(raw, lookup, language)];
}

/** The line as one part. A shared-amount list ("1 tsp each salt, cumin") is more than its first item, so that name is not exact. */
function whole(raw: string, lookup: IngredientLookup, language: string): ParsedIngredient {
  const p = parseIngredient(raw, lookup, language);
  return p.conceptExact && !p.also && SHARED_LIST.test(p.raw.replace(/\([^()]*\)/g, (b) => (SHARED_AMOUNT.test(b) ? ' ' : b))) ? { ...p, conceptExact: false } : p;
}

/** "¼ tsp each onion powder (, garlic powder)": one part per listed item, each with the shared amount; null unless every item is known. */
function sharedAmountParts(body: string, label: string, lookup: IngredientLookup, language: string): ParsedIngredient[] | null {
  const m = body.match(/^([^,]*\d[^,]*?)\s+(?:each|ciascun[oa]|ognuno)\s*:?\s+([^\d]+)$/iu);
  const pack = languagePacks[language]!;
  // Only the amount comes before "each": "2 tsp seasoning (or 1 tsp each of …)" is an alternative.
  if (!m || /[()]/.test(m[1]!) || new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu').test(m[1]!)) return null;
  const list = m[2]!.replace(/[()]/g, ',');
  if (new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu').test(list)) return null;
  const names = list.split(new RegExp(String.raw`\s*,\s*(?:(?:${pack.and}|&)\s+)?|\s+(?:${pack.and}|&)\s+`, 'iu')).map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) return null;
  const read = (list: string[]) => {
    const parts = list.map((name) => parseIngredient(`${label}${m[1]} ${name}`, lookup, language));
    return parts.every((p) => !p.kind && !!p.concept && p.conceptExact === true) ? parts : null;
  };
  // "garlic & onion powder": one-word items may share the last item's noun, when that names what they are.
  const noun = language === 'en' ? names.at(-1)!.match(/\s(powder|seeds|flakes|leaves|extract)$/i)?.[1] : undefined;
  const shared = noun && read(names.map((n, i) => (i < names.length - 1 && !/\s/.test(n) ? `${n} ${noun}` : n)));
  return shared || read(names);
}

/** Headings, equipment, instructions and asides written among the ingredients. */
function lineKind(raw: string, quantity: number | null, concept: string | null, name: string): ParsedIngredient['kind'] {
  if (quantity !== null || concept) return undefined;
  if (/:\s*$/.test(raw) || /^(?:for|per)\s+(?:the\s+|il\s+|la\s+|lo\s+|l['’]|i\s+|le\s+|gli\s+)?[^,;()]{1,40}$/i.test(raw)) return 'heading';
  if (!name) return 'other';
  if (/^(?:i|i'm|i've|you|we|use|add|serve|see|note|notes|tip|equipment|this|if|make|to make|recipe|check)\b/i.test(raw)) return 'other';
  if (/\b(?:mixing bowls?|baking (?:sheet|dish|pan)s?|skillet|blender|food processor|kitchen scale|scale for accuracy|thermometer|parchment paper|piping bag|muffin tin|loaf pan|cake pan|stand mixer|hand mixer)\b/i.test(raw)) return 'other';
  return undefined;
}

/**
 * The concept a name refers to: as written, else without a plant qualifier ("vegan coconut yogurt") or with
 * one typo fixed ("worcestshire sauce"), but only when what is left is not an animal word in the line's
 * language, so a qualifier or typo never turns a plant product into an animal one.
 */
function resolveName(text: string, lookup: IngredientLookup, language: string): string | null {
  const exact = lookupConcept(text, lookup);
  if (exact) return exact;
  const safe = (name: string) => findUnsafeRenderedTerms(name, language).length === 0;
  const plain = text.replace(/^(?:vegan|plant[ -]based|dairy[ -]free|non[ -]?dairy)\s+/i, '').replace(/\s+(?:vegan[oaie]|vegetal[ei])$/i, '');
  if (plain !== text) return safe(plain) ? lookupConcept(plain, lookup) : null;
  const near = safe(text) ? nearName(text, lookup) : null;
  return near && safe(near) ? lookupConcept(near, lookup) : null;
}

/** "15-ounce", "3-inch", "400 g": the size of one can or piece; null for anything else. */
function parseSize(text: string): ParsedIngredient['size'] {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*-?\s*([a-z]+\.?|"|”)$/i);
  const def = m ? lookupUnit(m[2] === '”' ? '"' : m[2]!) : undefined;
  return def && (def.dimension === 'mass' || def.dimension === 'volume' || def.unit === 'inch') ? { quantity: parseNumber(m![1]!), unit: def.unit } : null;
}

/** Each comma or bracket segment of a note that is a known preparation term; the rest is commentary. */
function noteTerms(note: string, lookup: IngredientLookup): PreparationTerm[] {
  const terms: PreparationTerm[] = [];
  // "(or parsley, chopped)": what follows an alternative inside its bracket describes the alternative.
  let depth = 0;
  let skipFrom: number | null = null;
  for (const token of note.match(/[()]|[^()]+/g) ?? []) {
    if (token === '(') { depth++; continue; }
    if (token === ')') { depth--; if (skipFrom !== null && depth < skipFrom) skipFrom = null; continue; }
    for (const segment of token.split(/[,;]|\s[-–—]\s/)) {
      const text = segment.trim().replace(/[.:]+$/, '');
      if (/^(?:or|o|oppure)\s/i.test(text)) skipFrom ??= depth;
      if (skipFrom !== null) continue;
      const id = text && lookupTerm(text, lookup);
      if (id && !terms.some((t) => t.id === id)) terms.push({ id, text });
    }
  }
  return terms;
}

/** `phrase` replaces the written name when an alternative was dropped; `sideTerms` were peeled off either side of a split. */
type Resolved = { concept: string; also: ParsedIngredient['also']; phrase?: string; sideTerms?: PreparationTerm[] };

/**
 * "finely chopped parsley", "salt and pepper to taste": peel known preparation terms off either end of the name
 * until what remains resolves to known ingredients, so no written word is lost.
 */
function peelTerms(phrase: string, resolve: (text: string) => Resolved | null, lookup: IngredientLookup, language = 'en'): (Resolved & { terms: PreparationTerm[] }) | null {
  let words = phrase.split(/\s+/).filter(Boolean);
  const lead: PreparationTerm[] = [];
  const trail: PreparationTerm[] = [];
  let branded = false;
  const take = (fromEnd: boolean) => {
    // "bob's red mill almond flour": a leading brand is dropped, not shown.
    const brand = fromEnd ? 0 : [4, 3, 2, 1].find((n) => n < words.length && lookupBrand(words.slice(0, n).join(' '), lookup));
    if (brand) {
      words = words.slice(brand);
      branded = true;
      return true;
    }
    // "unflavored and unsweetened milk": a connector between two leading terms goes with them.
    const skip = !fromEnd && lead.length && /^(?:and|&|or|,)$/i.test(words[0] ?? '') ? 1 : 0;
    for (let n = Math.min(5, words.length - 1 - skip); n > 0; n--) {
      const text = (fromEnd ? words.slice(-n) : words.slice(skip, skip + n)).join(' ');
      const id = lookupTerm(text, lookup);
      if (!id) continue;
      words = fromEnd ? words.slice(0, -n) : words.slice(skip + n);
      (fromEnd ? trail : lead).push({ id, text });
      return true;
    }
    return false;
  };
  let resolved = resolve(words.join(' '));
  while (!resolved && (take(false) || take(true))) resolved = resolve(words.join(' '));
  // A brand may be what made the name plant-based ("violife cheddar"): never resolve to an animal name without it.
  if (resolved && branded && findUnsafeRenderedTerms(words.join(' '), language).length) return null;
  return resolved ? { ...resolved, terms: [...lead, ...trail.reverse()] } : null;
}

/** Whether the words are all preparation terms ("plain", "unsweetened, plain"). */
function onlyTerms(text: string, lookup: IngredientLookup): boolean {
  let words = text.toLowerCase().split(/[\s,]+/).filter(Boolean);
  while (words.length) {
    const n = [3, 2, 1].find((k) => k <= words.length && lookupTerm(words.slice(0, k).join(' '), lookup));
    if (!n) return false;
    words = words.slice(n);
  }
  return true;
}

/**
 * "salt and ground pepper", "salt + pepper": two ingredients when both sides are known.
 * "walnuts or almonds", "cornflour / cornstarch": an alternative stays only when it names a known ingredient;
 * otherwise it is a substitution, which is commentary.
 */
function splitIngredients(phrase: string, lookup: IngredientLookup, language: string): Resolved | null {
  const pack = languagePacks[language]!;
  const m = phrase.match(new RegExp(`^(.+?)\\s+(${pack.and}|&|\\+|${pack.or}|\\/)\\s+(.+)$`, 'i'));
  if (!m) return null;
  const side = (text: string) => {
    const id = lookupConcept(text, lookup);
    if (id) return { concept: id, terms: [] as PreparationTerm[] };
    const peeled = peelTerms(text, (t) => { const c = lookupConcept(t, lookup); return c ? { concept: c, also: null } : null; }, lookup);
    return peeled ? { concept: peeled.concept, terms: peeled.terms } : null;
  };
  const joiner = [pack.or, '/'].includes(m[2]!.toLowerCase()) ? 'or' : 'and';
  const right = side(m[3]!);
  // "firm or extra firm tofu", "lemon or lime juice", "romano or ramiro pepper": the first option shares
  // the second's noun, which is tried before the first option alone.
  const tail = m[3]!.split(/\s+/);
  const shared = [1, 2].map((k) => tail.length > k ? lookupConcept(`${m[1]} ${tail.slice(-k).join(' ')}`, lookup) : null).find(Boolean);
  const left = shared ? { concept: shared, terms: [] as PreparationTerm[] } : side(m[1]!);
  // "tamari or soy sauce": an alternative vegdex knows stands in for one it does not.
  if (!left) return joiner === 'or' && right ? { concept: right.concept, also: null, phrase: m[3]!.trim(), sideTerms: right.terms } : null;
  if (!right || right.concept === left.concept) return joiner === 'or' ? { concept: left.concept, also: null, phrase: m[1]!.trim(), sideTerms: left.terms } : null;
  const name = language === 'en' ? canonicalName(m[3]!) : m[3]!.trim().toLowerCase();
  const sideTerms = [...left.terms, ...right.terms].filter((t, i, all) => all.findIndex((o) => o.id === t.id) === i);
  return { concept: left.concept, also: { concept: right.concept, name, joiner }, sideTerms };
}

/** Drop the alternative sides of "60 ml / ¼ cup / 4 tbsp" (or "75 g / 10 apricots" after a weight); the first measure is the one kept. */
function skipAltMeasure(s: string, countOk: boolean): string {
  const alt = s.match(ALT_MEASURE_RE);
  if (!alt) return s;
  const rest = s.slice(alt[0].length).replace(MEASURE_WORDS_RE, '');
  const u = rest.match(UNIT_RE);
  if (u && lookupUnit(u[1]!)) return skipAltMeasure(rest.slice(u[0].length), countOk);
  return countOk && /^\p{L}/u.test(rest) ? rest : s;
}
