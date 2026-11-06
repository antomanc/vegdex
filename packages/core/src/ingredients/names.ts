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
