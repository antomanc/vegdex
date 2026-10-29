import { cleanText } from './text';
import { isQualifiedIngredient, lookupConcept, type IngredientLookup } from './concepts';

export type Dimension = 'volume' | 'mass' | 'count' | 'other';

interface UnitDef {
  unit: string;
  dimension: Dimension;
  /** Size in ml (volume) or g (mass); 1 for count/other. */
  factor: number;
}

const UNIT_ALIASES: [string[], UnitDef][] = [
  [['cups', 'cup', 'c'], { unit: 'cup', dimension: 'volume', factor: 240 }],
  [['tablespoons', 'tablespoon', 'tbsps', 'tbsp', 'tbs', 'tbl', 'T'], { unit: 'tbsp', dimension: 'volume', factor: 15 }],
  [['teaspoons', 'teaspoon', 'tsps', 'tsp', 't'], { unit: 'tsp', dimension: 'volume', factor: 5 }],
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
  [['packages', 'package', 'packs', 'pack', 'pkg'], { unit: 'package', dimension: 'other', factor: 1 }],
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
  [['pieces', 'piece'], { unit: 'piece', dimension: 'other', factor: 1 }]
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
/** "60 ml / ¼ cup": the second, alternative measure of a dual measure. */
const ALT_MEASURE_RE = new RegExp(String.raw`^\/\s*(?:(?:heaped|heaping|packed|scant|generous|level)\s+)?(?:${NUM})(?:\s*(?:-|–|to)\s*(?:${NUM}))?\s*`, 'i');
/** "½ cup + 2 tbsp": a second amount added to the first. */
const PLUS_MEASURE_RE = new RegExp(String.raw`^\+\s*(${NUM})\s*`);
/** How full the spoon or cup is: says nothing about what to buy. */
const MEASURE_WORDS_RE = /^(?:(?:heaped|heaping|packed|loosely|lightly|firmly|scant|generous|rounded|level|approx\.?|approximately|about|around)\s+)+/i;
/** "3-inch piece", "2 cm piece": the size of a piece, kept as a note. */
const PIECE_SIZE_RE = /^(\d+(?:[.,]\d+)?\s*-?\s*(?:inch|in\.|cm|"|”))\s*/i;
/** "1 15 oz can": the size of the can, jar or block, kept as a note. */
const PACK_SIZE_RE = /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:oz\.?|ounces?|g|grams?|ml))\s*(?=(?:cans?|tins?|jars?|blocks?|bags?|packages?|packs?|cartons?|canned)\b)/i;

function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

export interface ParsedIngredient {
  /** False when mapping discarded source wording that display must retain. Absent in older datasets. */
  conceptExact?: boolean;
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
  s = s.replace(/\(\(/g, '(').replace(/\)\)/g, ')');
  s = s.replace(/\*+/g, '');
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
  s = s.replace(/[^a-z0-9&'\- ]/g, ' ');
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
export function parseIngredient(raw: string, lookup: IngredientLookup = {}): ParsedIngredient {
  let s = normalizeLine(raw);
  const optional = /\boptional\b/i.test(s);
  s = s.replace(MEASURE_WORDS_RE, '');
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: string | null = null;
  let altMeasure = '';

  const word = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half)\s+/i);
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
  } else if (word) {
    quantity = NUMBER_WORDS[word[1]!.toLowerCase()] ?? null;
    s = s.slice(word[0].length);
  }

  // "1 (15-ounce) can chickpeas": the parenthetical size belongs to the can.
  let sizeNote = '';
  s = s.replace(MEASURE_WORDS_RE, '');
  const size = s.match(/^\(([^)]*)\)\s*/) ?? s.match(PIECE_SIZE_RE) ?? s.match(PACK_SIZE_RE);
  if (size) {
    sizeNote = size[1]!;
    s = s.slice(size[0].length);
  }

  const u = s.match(UNIT_RE);
  if (u && quantity !== null) {
    const def = lookupUnit(u[1]!);
    if (def) {
      unit = def.unit;
      s = s.slice(u[0].length);
      const alt = skipAltMeasure(s);
      altMeasure = s.slice(0, s.length - alt.length);
      s = alt;
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
      }
    }
  } else if (u && /^(pinch|dash|handful|splash)/i.test(u[1]!)) {
    unit = lookupUnit(u[1]!)?.unit ?? null;
    quantity = 1;
    s = s.slice(u[0].length);
  }

  // "garlic cloves" written name-first.
  if (!unit && quantity !== null && /^(?:(?:x-large|extra-large|large|medium|small|big|fat)\s+)?garlic cloves?\b/i.test(s)) unit = 'clove';

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

  s = s.replace(/^\([^)]*\)\s*/, '').replace(/^of\s+(?:an?\s+)?/i, '');
  const commaAt = s.search(/,|\(/);
  const note = [sizeNote, commaAt >= 0 ? s.slice(commaAt) : ''].filter(Boolean).join(' ').replace(/^[,\s]+/, '');
  const name = canonicalName(s);
  const phrase = s.split(/,|\(/)[0]!;
  // "romano or ramiro pepper": a one-word first option shares the noun when that names a known ingredient.
  const shared = phrase.match(/^\s*([\p{L}'-]+)\s+or\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)*\s+([\p{L}'-]+)\s*$/iu);
  // Qualifiers in notes or unknown names must never disappear through canonicalization.
  const concept = isQualifiedIngredient(raw)
    ? (isQualifiedIngredient(phrase) ? lookupConcept(phrase, lookup) : null)
    : lookupConcept(phrase, lookup) ?? (shared && lookupConcept(canonicalName(`${shared[1]} ${shared[2]}`), lookup)) ?? lookupConcept(name, lookup);
  const conceptExact = !!concept && lookupConcept(phrase.replace(/\s+to taste$/i, ''), lookup) === concept;
  return { conceptExact, raw: cleanText(raw), quantity, quantityMax, unit, metric, afterMeasure, name, concept, note, optional };
}

/** Drop the alternative side of "60 ml / ¼ cup"; the first measure is the one kept. */
function skipAltMeasure(s: string): string {
  const alt = s.match(ALT_MEASURE_RE);
  if (!alt) return s;
  const rest = s.slice(alt[0].length).replace(MEASURE_WORDS_RE, '');
  const u = rest.match(UNIT_RE);
  return u && lookupUnit(u[1]!) ? rest.slice(u[0].length) : s;
}
