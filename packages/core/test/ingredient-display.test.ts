import { expect, it } from 'vitest';
import { compileGroceryList, displayGroceryName, parseIngredient, renderIngredient, type LanguageVocabulary } from '../src/index';

const lookup = {
  lemon: 'lemon', 'sea salt': 'salt', basil: 'basil', tomatoes: 'tomato', 'coconut yogurt': 'yogurt-coco', 'hot sauce': 'hot-sauce', cumin: 'cumin', nutmeg: 'nutmeg',
  juiced: 'term:juiced', zested: 'term:zested', fresh: 'term:fresh', 'more to taste': 'term:to-taste', 'plus more to taste': 'term:to-taste',
  '+ more to taste': 'term:to-taste', 'as needed': 'term:as-needed', canned: 'term:canned', unsweetened: 'term:unsweetened',
  chickpeas: 'chickpea', chickpea: 'chickpea', flour: 'flour', salt: 'salt', pepper: 'pepper', onion: 'onion', onions: 'onion',
  'olive oil': 'oil', 'soy sauce': 'soy', 'firm tofu': 'tofu', scallion: 'scallion', 'vegan butter': 'butter', yogurt: 'yogurt',
  walnuts: 'walnut', almonds: 'almond', carrots: 'carrot',
  'drained and rinsed': 'term:drained-rinsed', sifted: 'term:sifted', 'to taste': 'term:to-taste', diced: 'term:diced',
  minced: 'term:minced', chopped: 'term:chopped', 'for garnish': 'term:for-garnish', large: 'term:large', optional: 'term:optional'
};
const it_: LanguageVocabulary = {
  language: 'it',
  names: {
    chickpea: { one: 'cece', other: 'ceci', gender: 'm' }, flour: { one: 'farina', other: 'farina', gender: 'f' },
    salt: { one: 'sale', other: 'sale', gender: 'm' }, pepper: { one: 'pepe', other: 'pepe', gender: 'm' },
    onion: { one: 'cipolla', other: 'cipolle', gender: 'f' }, oil: { one: "olio d'oliva", other: "olio d'oliva", gender: 'm' },
    soy: { one: 'salsa di soia', other: 'salsa di soia', gender: 'f' }, tofu: { one: 'tofu compatto', other: 'tofu compatto', gender: 'm' },
    scallion: { one: 'cipollotto', other: 'cipollotti', gender: 'm' }, butter: { one: 'burro vegano', other: 'burro vegano', gender: 'm' },
    carrot: { one: 'carota', other: 'carote', gender: 'f' }, walnut: { one: 'noce', other: 'noci', gender: 'f' },
    almond: { one: 'mandorla', other: 'mandorle', gender: 'f' }, lemon: { one: 'limone', other: 'limoni', gender: 'm' },
    basil: { one: 'basilico', other: 'basilico', gender: 'm' }, tomato: { one: 'pomodoro', other: 'pomodori', gender: 'm' },
    'yogurt-coco': { one: 'yogurt di cocco', other: 'yogurt di cocco', gender: 'm' }, 'hot-sauce': { one: 'salsa piccante', other: 'salsa piccante', gender: 'f' },
    cumin: { one: 'cumino', other: 'cumino', gender: 'm' }
  },
  terms: {
    'term:drained-rinsed': { m: 'scolato e sciacquato', f: 'scolata e sciacquata', 'm.pl': 'scolati e sciacquati', 'f.pl': 'scolate e sciacquate' },
    'term:sifted': { m: 'setacciato', f: 'setacciata', 'm.pl': 'setacciati', 'f.pl': 'setacciate' },
    'term:diced': { m: 'a dadini', f: 'a dadini', 'm.pl': 'a dadini', 'f.pl': 'a dadini' },
    'term:minced': { m: 'tritato', f: 'tritata', 'm.pl': 'tritati', 'f.pl': 'tritate' },
    'term:chopped': { m: 'tritato', f: 'tritata', 'm.pl': 'tritati', 'f.pl': 'tritate' },
    'term:to-taste': { m: 'quanto basta', f: 'quanto basta', 'm.pl': 'quanto basta', 'f.pl': 'quanto basta' },
    'term:for-garnish': { m: 'per guarnire', f: 'per guarnire', 'm.pl': 'per guarnire', 'f.pl': 'per guarnire' },
    'term:large': { m: 'grande', f: 'grande', 'm.pl': 'grandi', 'f.pl': 'grandi' },
    'term:juiced': { m: 'spremuto', f: 'spremuta', 'm.pl': 'spremuti', 'f.pl': 'spremute' },
    'term:fresh': { m: 'fresco', f: 'fresca', 'm.pl': 'freschi', 'f.pl': 'fresche' },
    'term:as-needed': { m: 'più quanto basta', f: 'più quanto basta', 'm.pl': 'più quanto basta', 'f.pl': 'più quanto basta' },
    'term:canned': { m: 'in scatola', f: 'in scatola', 'm.pl': 'in scatola', 'f.pl': 'in scatola' },
    'term:unsweetened': { m: 'senza zucchero', f: 'senza zucchero', 'm.pl': 'senza zucchero', 'f.pl': 'senza zucchero' }
  },
  units: {
    g: ['g', 'g'], ml: ['ml', 'ml'], cup: ['tazza', 'tazze'], tbsp: ['cucchiaio', 'cucchiai'], tsp: ['cucchiaino', 'cucchiaini'],
    block: ['panetto', 'panetti'], oz: ['oncia', 'once'], handful: ['manciata', 'manciate'], head: ['cespo', 'cespi'], can: ['scatola', 'scatole']
  },
  titles: {}
};
const en: LanguageVocabulary = {
  language: 'en', names: {}, terms: {},
  units: { g: ['g', 'g'], cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], block: ['block', 'blocks'], oz: ['oz', 'oz'] },
  titles: {}
};
const render = (line: string, units: 'us' | 'metric' = 'metric', vocab = it_, language = 'it') =>
  renderIngredient(parseIngredient(line, lookup), vocab, language, units);

it('composes a line from vocabulary names and preparation terms', () => {
  expect(render('400 g chickpeas, drained and rinsed')).toEqual(['400 g', 'ceci, scolati e sciacquati']);
  expect(render('2 cups flour, sifted')).toEqual(['≈ 250 g', 'farina, setacciata']);
  expect(render('2 cups flour (280 g)')).toEqual(['280 g', 'farina']);
  expect(render('1–2 cups flour')).toEqual(['≈ 125–250 g', 'farina']);
});

it('agrees in number and gender', () => {
  expect(render('2 onions, diced')).toEqual(['2', 'cipolle, a dadini']);
  expect(render('1 onion, minced')).toEqual(['1', 'cipolla, tritata']);
  expect(render('1/2 onion, minced')).toEqual(['½', 'cipolla, tritata']);
});

it('writes kitchen fractions and links spoon units to the name', () => {
  expect(render('1 1/2 tbsp olive oil', 'us')).toEqual(['1 ½ cucchiai', "di olio d'oliva"]);
  expect(render('1/4 teaspoon salt', 'us')).toEqual(['¼ cucchiaino', 'di sale']);
  expect(render('0.5 tsp salt', 'metric')).toEqual(['½ cucchiaino', 'di sale']);
});

it('uses a package size as the metric amount and keeps it beside the count in US units', () => {
  expect(render('1 (16 ounce) block firm tofu')).toEqual(['454 g', 'tofu compatto']);
  expect(render('1 (16 ounce) block firm tofu', 'us')).toEqual(['1 panetto (16 once)', 'di tofu compatto']);
});

it('leaves commentary out in every language', () => {
  const line = '1 tablespoon soy sauce (gluten free if needed, or liquid aminos or tamari)';
  expect(render(line)).toEqual(['1 cucchiaio', 'di salsa di soia']);
  expect(render(line, 'us', en, 'en')).toEqual(['1 tbsp', 'soy sauce']);
  expect(render('½ cup sugar (I use cane sugar, you can use brown)', 'us', en, 'en')).toEqual(['½ cup', 'sugar']);
});

it('peels preparation words off the name only when the rest is a known ingredient', () => {
  expect(render('chopped scallion (for garnish)')).toEqual(['', 'cipollotti tritati, per guarnire']);
  expect(render('salt to taste')).toEqual(['', 'sale quanto basta']);
  expect(render('2 large carrots')).toEqual(['2', 'carote grandi']);
  expect(render('chopped scallion (for garnish)', 'us', en, 'en')).toEqual(['', 'chopped scallion, for garnish']);
});

it('drops an unknown alternative as commentary and keeps plant names whose note mentions a qualifier', () => {
  expect(render('2 tbsp olive oil or any neutral oil', 'us')).toEqual(['2 cucchiai', "di olio d'oliva"]);
  expect(render('salt + pepper')).toEqual(['', 'sale e pepe']);
  expect(render('salt and chopped scallion')).toEqual(['', 'sale e cipollotti tritati']);
  expect(render('1 cup chickpeas (or any vegan protein)', 'us')).toEqual(['1 tazza', 'di ceci']);
  expect(parseIngredient('1 cup yogurt (vegan)', lookup).concept).toBeNull();
  expect(render('2 tbsp olive oil or any neutral oil', 'us', en, 'en')).toEqual(['2 tbsp', 'olive oil']);
});

it('splits two known ingredients joined by and or or', () => {
  expect(render('salt and pepper to taste')).toEqual(['', 'sale e pepe quanto basta']);
  expect(render('salt and pepper, to taste')).toEqual(['', 'sale e pepe, quanto basta']);
  expect(render('1 cup walnuts or almonds', 'us')).toEqual(['1 tazza', 'di noci o mandorle']);
  expect(render('salt and pepper to taste', 'us', en, 'en')).toEqual(['', 'salt and pepper to taste']);
});

it('keeps the original line in another language whenever any part is missing or unsafe', () => {
  const p = parseIngredient('400 g chickpeas, drained and rinsed', lookup);
  expect(renderIngredient(p, { ...it_, terms: {} }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(p, { ...it_, names: {} }, 'it', 'metric')).toBeNull();
  expect(renderIngredient(parseIngredient('1 cup flour', lookup), { ...it_, units: {} }, 'it', 'us')).toBeNull();
  expect(renderIngredient(p, { ...it_, names: { chickpea: { one: 'pollo', other: 'polli', gender: 'm' } } }, 'it', 'metric')).toBeNull();
  expect(render('2 cups mystery flour')).toBeNull();
  expect(render('1 cup yogurt (I used soy yogurt)')).toBeNull();
  expect(render('1 cup yogurt (I used soy yogurt)', 'us', en, 'en')).toBeNull();
  expect(render('2 tbsp vegan butter', 'us')).toEqual(['2 cucchiai', 'di burro vegano']);
});

it('shows unknown ingredients in their own language as written, minus commentary', () => {
  expect(render('2 cups mystery flour (the good kind), sifted', 'us', en, 'en')).toEqual(['2 cups', 'mystery flour, sifted']);
});

it('keeps original amounts when parsing discarded fill qualifiers', () => {
  for (const line of ['2 heaped tbsp flour', '2 scant cups flour', '2 loosely packed cups flour', 'one rounded cup flour', '60 ml / heaped 1/4 cup flour'])
    for (const units of ['metric', 'us'] as const) expect(render(line, units), line).toBeNull();
});

it('reads the shapes recipes write ingredients in', () => {
  expect(render('Juice of 1 lemon (1-2 tablespoons)')).toEqual(['1', 'limone, spremuto']);
  expect(render('1/2 teaspoon sea salt + more to taste', 'us')).toEqual(['½ cucchiaino', 'di sale quanto basta']);
  expect(render('1 large handful of fresh basil (or parsley, chopped)', 'us')).toEqual(['1 manciata', 'di basilico fresco']);
  expect(render('1/2 cup (~112g) vegan coconut yogurt (unsweetened, plain)', 'metric')).toEqual(['112 g', 'yogurt di cocco, senza zucchero']);
  expect(render('2 x 400 g / 14 oz canned tomatoes', 'metric')).toEqual(['800 g', 'pomodori in scatola']);
  expect(render('more hot sauce')).toEqual(['', 'salsa piccante, più quanto basta']);
  expect(render('1/3 tsp or more cumin', 'us')).toEqual(['⅓ cucchiaino', 'di cumino, più quanto basta']);
  expect(render('1/8 teaspoon each of ground nutmeg', 'us')).toBeNull(); // nutmeg has no Italian name here
  expect(render('1 cup chickpeas; see notes for gluten-free', 'us')).toEqual(['1 tazza', 'di ceci']);
  expect(render('1 cup chickpeas of choice', 'us')).toEqual(['1 tazza', 'di ceci']);
  expect(render('1 large head cauliflower (cut into florets (about 2.5 pounds)', 'us', en, 'en')).toBeNull(); // unknown here, but no longer blocked by the note
  expect(parseIngredient('1 large head cauliflower (about 2.5 pounds)', { cauliflower: 'cauli' })).toMatchObject({ unit: 'head', concept: 'cauli' });
});

it('marks headings and asides so no language shows them as ingredients', async () => {
  const { isHiddenLine } = await import('../src/index');
  const kinds = ['For the sauce:', 'For the dressing', 'Serve with my Vegan Lemon Cream Sauce', 'I use this scale.', 'Medium and Large Mixing Bowls', '2 tbsp olive oil', 'salt to taste']
    .map((line) => parseIngredient(line, lookup).kind ?? null);
  expect(kinds).toEqual(['heading', 'heading', 'other', 'other', 'other', null, null]);
  const heading = parseIngredient('For the sauce:', lookup);
  expect([isHiddenLine(heading, 'en'), isHiddenLine(heading, 'it'), isHiddenLine(parseIngredient('I use this scale.'), 'en')]).toEqual([false, true, true]);
  expect(render('Serve with rice')).toBeNull();
});

it('shows an approximate amount as approximate', () => {
  expect(render('about 2 tbsp flour', 'us')).toEqual(['circa 2 cucchiai', 'di farina']);
  expect(render('approximately 2 cups flour', 'us')).toEqual(['circa 2 tazze', 'di farina']);
  expect(render('approximately 2 cups flour', 'metric')).toEqual(['≈ 250 g', 'farina']);
  expect(render('about 400 g chickpeas', 'metric')).toEqual(['circa 400 g', 'ceci']);
  expect(render('about 2 tbsp flour', 'us', en, 'en')).toEqual(['about 2 tbsp', 'flour']);
});

it('keeps originals for cached parsed data from before preparation terms', () => {
  const { terms: _, ...legacy } = parseIngredient('400 g chickpeas, drained and rinsed', lookup);
  expect(renderIngredient(legacy, it_, 'it', 'metric')).toBeNull();
});

it('translates grocery names after synonym aggregation while keeping stable row keys and amounts', () => {
  const items = compileGroceryList([
    { recipeId: 'a', ingredients: ['400 g chickpeas'], multiplier: 1 },
    { recipeId: 'b', ingredients: ['200 g garbanzo'], multiplier: 0.5 }
  ], { lookup: { chickpeas: 'chickpea', garbanzo: 'chickpea' }, concepts: { chickpea: ['chickpea', 'beans & legumes'] } });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ name: 'chickpea', concept: 'chickpea', amounts: ['500 g'], recipeIds: ['a', 'b'] });
  expect(displayGroceryName(items[0]!, it_, 'it')).toBe('ceci');
  expect(displayGroceryName(items[0]!, { ...it_, names: { chickpea: { one: 'pollo', other: 'pollo' } } }, 'it')).toBe('chickpea');
});

it('shops for both ingredients of an and-line and the first of an or-line', () => {
  const items = compileGroceryList([{ recipeId: 'a', ingredients: ['salt and pepper to taste', '1 cup walnuts or almonds'], multiplier: 1 }], { lookup });
  expect(items.map((i) => i.concept).sort()).toEqual(['pepper', 'salt', 'walnut']);
});
