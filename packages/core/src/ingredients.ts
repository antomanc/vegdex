import { cleanText } from './text';

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
  [['scoops', 'scoop'], { unit: 'scoop', dimension: 'other', factor: 1 }]
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

function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

export interface ParsedIngredient {
  raw: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** Metric weight or volume from a parenthetical like "(240 g)". */
  metric: { quantity: number; unit: 'g' | 'ml' } | null;
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
  'some', 'few', 'handful', 'bunch', 'container', 'pack', 'heaping', 'rounded', 'dry', 'sprinkle', 'for'
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
  let s = phrase.toLowerCase();
  s = s.replace(/\([^)]*\)?/g, ' ');
  s = s.split(/,|;|\s[-–—]\s|:/)[0] ?? s;
  // Alternatives: keep the first ("tapioca flour or cornstarch" → "tapioca flour").
  s = s.split(/\s(?:or|\/)\s/)[0] ?? s;
  s = s.replace(/\b(to taste|as needed|for (?:serving|garnish|topping|frying|the pan|greasing|drizzling)|if needed|optional)\b.*$/, '');
  s = s.replace(/[^a-z0-9&'\- ]/g, ' ');
  const kept = s.split(/\s+/).filter((w) => w && !DESCRIPTORS.has(w) && !/^\d/.test(w));
  let name = kept.join(' ').trim();
  if (SYNONYMS[name]) return SYNONYMS[name];
  const words = name.split(' ');
  if (words.length > 0) words[words.length - 1] = singularize(words[words.length - 1]!);
  name = words.join(' ');
  return SYNONYMS[name] ?? name;
}

/** Parse one published ingredient line into quantity, unit and canonical name. */
export function parseIngredient(raw: string): ParsedIngredient {
  let s = normalizeLine(raw);
  const optional = /\boptional\b/i.test(s);
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: string | null = null;

  const word = s.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half)\s+/i);
  const q = s.match(QTY_RE);
  if (q) {
    quantity = parseNumber(q[1]!);
    quantityMax = q[2] ? parseNumber(q[2]) : null;
    s = s.slice(q[0].length);
  } else if (word) {
    quantity = NUMBER_WORDS[word[1]!.toLowerCase()] ?? null;
    s = s.slice(word[0].length);
  }

  // "1 (15-ounce) can chickpeas": the parenthetical size belongs to the can.
  let sizeNote = '';
  const size = s.match(/^\(([^)]*)\)\s*/);
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
    }
  } else if (u && /^(pinch|dash|handful|splash)/i.test(u[1]!)) {
    unit = lookupUnit(u[1]!)?.unit ?? null;
    quantity = 1;
    s = s.slice(u[0].length);
  }

  // "garlic cloves" written name-first.
  if (!unit && quantity !== null && /^garlic cloves?\b/i.test(s)) unit = 'clove';

  const metricSource = (s.match(/^\(([^)]*)\)/)?.[1] ?? '') || (unit && ['cup', 'tbsp', 'tsp', 'oz', 'lb'].includes(unit) ? sizeNote : '');
  let metric = metricSource ? extractMetric(metricSource) : null;
  if (unit && (unit === 'g' || unit === 'kg') && quantity !== null)
    metric = { quantity: quantity * (unit === 'kg' ? 1000 : 1), unit: 'g' };
  if (unit && (unit === 'ml' || unit === 'l') && quantity !== null)
    metric = { quantity: quantity * (unit === 'l' ? 1000 : 1), unit: 'ml' };

  s = s.replace(/^\([^)]*\)\s*/, '').replace(/^of\s+/i, '');
  const commaAt = s.search(/,|\(/);
  const head = commaAt >= 0 ? s.slice(0, commaAt) : s;
  const note = [sizeNote, commaAt >= 0 ? s.slice(commaAt) : ''].filter(Boolean).join(' ').replace(/^[,\s]+/, '');
  return { raw: cleanText(raw), quantity, quantityMax, unit, metric, name: canonicalName(head), note, optional };
}
