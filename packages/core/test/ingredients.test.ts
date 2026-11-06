import { describe, expect, it } from 'vitest';
import { parseIngredient, parseLine, toMetric, scaleIngredient } from '../src';

describe('parseIngredient', () => {
  it.each([
    'Serve with my Vegan Lemon Cream Sauce',
    'I make my own homemade almond milk very creamy',
    'Pumpkin pie spice is a blend of cinnamon',
    "If you are using cashews and you don't have a high-powered blender"
  ])('preserves original text for the recipe sheet: %s', (line) => {
    expect(parseIngredient(line).raw).toBe(line);
  });

  it.each([
    ['1/2 cup (~60g) raw cashews, soaked in cool water overnight', 0.5, 'cup', 'cashew', { quantity: 60, unit: 'g' }],
    ['1 ½ teaspoons kosher salt + more to taste', 1.5, 'tsp', 'salt', null],
    ['&#189; Tbsp fine sea salt', 0.5, 'tbsp', 'salt', null],
    ['1&#8532; cup canned full-fat coconut milk', 1 + 2 / 3, 'cup', 'coconut milk', null],
    ['6 garlic clove', 6, 'clove', 'garlic', null],
    ['3 cloves garlic, minced', 3, 'clove', 'garlic', null],
    ['1 (15-ounce) can chickpeas, drained and rinsed', 1, 'can', 'chickpea', null],
    ['10 ounces (280g) of rigatoni pasta, medium-sized macaroni shells', 10, 'oz', 'rigatoni pasta', { quantity: 280, unit: 'g' }],
    ['1 tablespoon tapioca flour or cornstarch', 1, 'tbsp', 'tapioca flour', null],
    ['2 large onions, diced', 2, null, 'onion', null],
    ['200 g extra-firm tofu, pressed', 200, 'g', 'tofu', { quantity: 200, unit: 'g' }],
    ['2-3 tbsp maple syrup', 2, 'tbsp', 'maple syrup', null],
    ['1 T olive oil', 1, 'tbsp', 'olive oil', null],
    ['1 t baking soda', 1, 'tsp', 'baking soda', null],
    ['Freshly cracked black pepper to taste', null, null, 'black pepper', null],
    ['Olive oil or avocado oil, (for roasting)', null, null, 'olive oil', null],
    ['2 scallions, thinly sliced', 2, null, 'green onion', null],
    ['1 cup cherry tomatoes, halved', 1, 'cup', 'cherry tomato', null],
    ['a pinch of salt', 1, 'pinch', 'salt', null]
  ])('%s', (line, quantity, unit, name, metric) => {
    const p = parseIngredient(line);
    if (quantity === null) expect(p.quantity).toBeNull();
    else expect(p.quantity).toBeCloseTo(quantity);
    expect(p.unit).toBe(unit);
    expect(p.name).toBe(name);
    if (metric) expect(p.metric).toEqual(metric);
  });

  it.each(['70% dark chocolate', '70-85% dark chocolate'])('does not count percentages: %s', (line) => {
    expect(parseIngredient(line).quantity).toBeNull();
  });

  it.each([
    ['1 (14 ounce/400 gram) package extra firm tofu', 400],
    ['2 cans pumpkin puree (15-ounces each) (850g)', 850],
    ['2 cans (15 oz / 425g each) butter beans', 850],
    ['2 (400g total) packages firm tofu', 400]
  ])('keeps package metric weights: %s', (line, quantity) => {
    expect(parseIngredient(line).metric).toEqual({ quantity, unit: 'g' });
    expect(toMetric(parseIngredient(line))?.quantity).toBe(quantity);
  });

  it.each(['2 cans full-fat coconut milk (3 cups)', '2 sticks vegan butter (16 tablespoons or 1 cup)'])('keeps honest counts: %s', (line) => {
    expect(parseIngredient(line).quantity).toBe(2);
    expect(parseIngredient(line).metric).toBeNull();
  });

  it.each([
    ['2 3/4 cups (265-280g) rolled oats', 265, 280],
    ['2-3 tablespoons (30-45g) chocolate chips', 30, 45],
    ['400 g / 14 oz - 800 g / 28 oz firm tofu', 400, 800]
  ])('preserves explicit metric ranges: %s', (line, quantity, quantityMax) => {
    const p = parseIngredient(line);
    expect(p.metric?.quantityMax !== undefined ? toMetric(p) : p).toMatchObject({ quantity, quantityMax, unit: 'g' });
  });

  it('scales both ends of a stated metric range', () => {
    const p = parseIngredient('2 3/4 cups (265-280g) rolled oats');
    expect(toMetric(scaleIngredient(p, 2, 'metric'))).toMatchObject({ quantity: 530, quantityMax: 560, unit: 'g' });
  });

  it('keeps ranges', () => {
    expect(parseIngredient('2-3 tbsp maple syrup').quantityMax).toBe(3);
  });

  // Shapes that show up across the catalog and used to leak units or descriptors into the name.
  it.each([
    ['60 ml / ¼ cup water', 60, 'ml', 'water'],
    ['130 g / 1 cup raw cashews*', 130, 'g', 'cashew'],
    ['1 and 1/2 tbsp olive oil', 1.5, 'tbsp', 'olive oil'],
    ['1 and 1/2 tbsp chipotle peppers in adobo sauce (finely chopped)', 1.5, 'tbsp', 'chipotle peppers in adobo sauce'],
    ['1/4 + 1/8 teaspoon salt', 0.375, 'tsp', 'salt'],
    ['heaped ¼ tsp baking soda', 0.25, 'tsp', 'baking soda'],
    ['1/3 heaped cup sunflower seeds', 1 / 3, 'cup', 'sunflower seed'],
    ['1 heaping tbsp tomato paste', 1, 'tbsp', 'tomato paste'],
    ['½ cup + 2 tbsp caster sugar', 0.625, 'cup', 'sugar'],
    ['1 cup+ 2 Tablespoons all-purpose flour', 1.125, 'cup', 'all-purpose flour'],
    ['1 3-inch piece of ginger (, peeled and sliced)', 1, 'piece', 'ginger'],
    ['¼ of a small red onion (chopped)', 0.25, null, 'red onion'],
    ['1/3 cup packed light or dark coconut sugar', 1 / 3, 'cup', 'coconut sugar'],
    ['14 oz firm or extra firm tofu (, pressed for 5 mins and cubed)', 14, 'oz', 'tofu'],
    ['1 tbsp plain, unsweetened non-dairy milk', 1, 'tbsp', 'plant milk'],
    ['350 g silken (firm) tofu', 350, 'g', 'tofu'],
    ['3 cloves minced or grated garlic', 3, 'clove', 'garlic'],
    ['2 cups frozen or fresh raspberries', 2, 'cup', 'raspberry'],
    ['1 15 oz can chickpeas, drained', 1, 'can', 'chickpea'],
    ['three 15 oz cans black beans', 3, 'can', 'black bean'],
    ['2 inch piece of fresh ginger (coarsely chopped)', 2, 'inch', 'ginger'],
    ['40 g / heaped 1/3 cup cocoa powder', 40, 'g', 'cocoa powder'],
    ['4 loosely packed cups (50g) fresh basil leaves', 4, 'cup', 'basil leaf'],
    ['4 x-large garlic cloves', 4, 'clove', 'garlic']
  ])('%s', (line, quantity, unit, name) => {
    const p = parseIngredient(line);
    expect(p.quantity).toBeCloseTo(quantity);
    expect(p.unit).toBe(unit);
    expect(p.name).toBe(name);
  });

  it('keeps the metric side of a dual measure', () => {
    expect(parseIngredient('30-45 ml / 2-3 tbsp lemon juice')).toMatchObject({ quantity: 30, quantityMax: 45, unit: 'ml', name: 'lemon juice' });
  });

  it.each([
    ['2 tbsp bánh mì sauce', 'bánh mì sauce'],
    ['1 tbsp ají panca paste', 'ají panca paste'],
    ['1 pickled jalapeño, sliced', 'pickled jalapeño']
  ])('keeps accented letters in the name: %s', (line, name) => {
    expect(parseIngredient(line).name).toBe(name);
  });

  it.each([
    ['5 garlic cloves, minced', 'garlic'],
    ['3 large garlic cloves', 'garlic'],
    ['2 fat garlic cloves, finely diced', 'garlic'],
    ['1 garlic clove', 'garlic']
  ])('names a name-first garlic line like a measure-first one: %s', (line, phrase) => {
    expect(parseIngredient(line)).toMatchObject({ unit: 'clove', phrase, name: 'garlic' });
  });

  it.each([['2 cloves garlic, minced', 'garlic']])('keeps measure-first garlic lines as they were: %s', (line, name) => {
    expect(parseIngredient(line).name).toBe(name);
  });
});

describe('amount shapes that used to leak into the name', () => {
  const lookup: Record<string, string> = {
    rice: 'rice', 'basmati rice': 'rice', water: 'water', 'shredded coconut': 'coconut', 'soy milk': 'soy-milk', ginger: 'ginger',
    'diced tomatoes': 'tomato', 'artichoke hearts': 'artichoke', spinach: 'spinach', 'maple syrup': 'maple', 'non-dairy milk': 'plant-milk',
    'dairy-free milk': 'plant-milk', 'dried apricots': 'apricot', 'olive oil': 'olive-oil', 'all purpose white flour': 'flour', flour: 'flour',
    'red bell pepper': 'bell-pepper', buns: 'bun', bread: 'bread', 'lime juice': 'lime-juice', 'lemon juice': 'lemon-juice', parsley: 'parsley',
    basil: 'basil', 'basil leaves': 'basil', cumin: 'cumin', 'rum extract': 'rum', 'vegan cheese sauce': 'cheese-sauce', thyme: 'thyme',
    'crushed tomatoes': 'crushed-tomatoes', 'can crushed tomatoes': 'canned-crushed-tomatoes', sprinkles: 'sprinkles', 'red pepper flakes': 'chili-flakes',
    cinnamon: 'cinnamon', 'garbanzo bean flour': 'chickpea-flour',
    small: 'term:small', fresh: 'term:fresh', sliced: 'term:sliced', optional: 'term:optional', 'to taste': 'term:to-taste', 'plus more for dusting': 'term:for-dusting'
  };

  it.each([
    ['1 cup 180g basmati rice', 1, null, 'cup', 'rice'],
    ['2 tablespoons 30 ml water', 2, null, 'tbsp', 'water'],
    ['.5 cup soy milk (120ml)', 0.5, null, 'cup', 'soy-milk'],
    ['1-inch (2.5 cm) piece of ginger', 1, null, 'inch', 'ginger'],
    ['1 14 ounce artichoke hearts', 14, null, 'oz', 'artichoke'],
    ['1/2 cup plus 2 tablespoons maple syrup', 0.625, null, 'cup', 'maple'],
    ['3/4 cup (180 ml) + 2 tablespoons dairy-free milk', 0.875, null, 'cup', 'plant-milk'],
    ['¼ cup + 2 tbsp / 90 ml water', 0.375, null, 'cup', 'water'],
    ['½ cup – 1 cup non-dairy milk', 0.5, 1, 'cup', 'plant-milk'],
    ['75 g / 10 dried apricots', 75, null, 'g', 'apricot'],
    ['30-45 / 2-3 tbsp olive oil', 2, 3, 'tbsp', 'olive-oil'],
    ['150 g / 1 and ½ cups of all purpose white flour', 150, null, 'g', 'flour'],
    ['3 ⁄4 teaspoon cumin', 0.75, null, 'tsp', 'cumin'],
    // Scraping leftovers that older answers learned as part of the name.
    ['1/2” ginger', 0.5, null, 'inch', 'ginger'],
    ['1 c . basmati rice', 1, null, 'cup', 'rice'],
    ['½. cup basmati rice', 0.5, null, 'cup', 'rice'],
    ['2 teaspoons cumin.', 2, null, 'tsp', 'cumin'],
    ['1/4 teaspoon cumin\u2063', 0.25, null, 'tsp', 'cumin'],
    ['1 cup basmati rice | (rinsed)', 1, null, 'cup', 'rice'],
    ['A generous ¾ cup water', 0.75, null, 'cup', 'water'],
    ['a good pinch of cumin', 1, null, 'pinch', 'cumin'],
    ['1 heaping cup (150g) 1/4 inch sliced spinach', 1, null, 'cup', 'spinach'],
    ['1 package of 4 buns', 1, null, 'package', 'bun'],
    ['1 batch of vegan cheese sauce', 1, null, 'batch', 'cheese-sauce'],
    ['1 3/4 cups water + 2 tablespoons', 1.75, null, 'cup', 'water'],
    ['2 cups flour + more for dusting', 2, null, 'cup', 'flour'],
    // An alternative with its own amount is dropped, never shown under the first amount.
    ['4 buns or 8 slices of bread', 4, null, null, 'bun'],
    ['1 tbsp fresh thyme or 1/2 tsp dried thyme', 1, null, 'tbsp', 'thyme'],
    ['2 small or 1 large red bell pepper', 2, null, null, 'bell-pepper'],
    ['1/3 cup chickpea/garbanzo bean flour', 1 / 3, null, 'cup', 'chickpea-flour']
  ])('%s', (line, quantity, quantityMax, unit, concept) => {
    const p = parseIngredient(line, lookup);
    expect(p.quantity).toBeCloseTo(quantity);
    expect(p.quantityMax).toBe(quantityMax);
    expect(p.unit).toBe(unit);
    expect({ concept: p.concept, exact: p.conceptExact }).toEqual({ concept, exact: true });
  });

  it('keeps the size of a counted or weighed package', () => {
    expect(parseIngredient('1 14.5 ounce (410 g) can diced tomatoes', lookup)).toMatchObject({ quantity: 1, unit: 'can', size: { quantity: 14.5, unit: 'oz' }, concept: 'tomato' });
    expect(parseIngredient('10 ounce package spinach (thawed)', lookup)).toMatchObject({ quantity: 1, unit: 'package', size: { quantity: 10, unit: 'oz' }, concept: 'spinach' });
  });

  it('tries a name with the container words an older parse left in it', () => {
    expect(parseIngredient('28 ounces can crushed tomatoes', lookup).concept).toBe('canned-crushed-tomatoes');
  });

  it('reads approximate and open amounts', () => {
    expect(parseIngredient('~1/3 cup shredded coconut', lookup)).toMatchObject({ quantity: 1 / 3, unit: 'cup', approx: true, concept: 'coconut' });
    expect(parseIngredient('1/2 teaspoon or so of cinnamon', lookup)).toMatchObject({ quantity: 0.5, unit: 'tsp', approx: true, concept: 'cinnamon' });
    expect(parseIngredient('pinch or two of red pepper flakes', lookup)).toMatchObject({ quantity: 1, unit: 'pinch', approx: true, concept: 'chili-flakes' });
    expect(parseIngredient('a few basil leaves', lookup)).toMatchObject({ quantity: null, concept: 'basil', conceptExact: true, terms: [{ id: 'term:to-taste' }] });
    expect(parseIngredient('A few drops of rum extract', lookup)).toMatchObject({ quantity: null, unit: null, concept: 'rum' });
  });

  it('splits two named alternatives', () => {
    expect(parseIngredient('2 tsp lime/lemon juice', lookup)).toMatchObject({ concept: 'lime-juice', also: { concept: 'lemon-juice', joiner: 'or' } });
    expect(parseIngredient('1/3 cup fresh basil and/or parsley', lookup)).toMatchObject({ concept: 'basil', also: { concept: 'parsley', joiner: 'or' } });
  });

  it('drops a label naming one ingredient and keeps a list as written', () => {
    expect(parseIngredient('Spices: 1 tsp cumin', lookup)).toMatchObject({ quantity: 1, unit: 'tsp', concept: 'cumin', raw: 'Spices: 1 tsp cumin' });
    expect(parseIngredient('Toppings: basil leaves', lookup)).toMatchObject({ concept: 'basil', optional: true, terms: [{ id: 'term:optional' }] });
    expect(parseIngredient('(optional) 1 teaspoon cumin', lookup)).toMatchObject({ concept: 'cumin', optional: true });
    expect(parseIngredient('Garnish: chopped parsley, lemon wedges', lookup)).toMatchObject({ concept: null });
    expect(parseIngredient('Garnish: chopped parsley, lemon wedges', lookup).kind).toBeUndefined();
  });

  it('never reads a food as a unit', () => {
    expect(parseIngredient('sprinkles, for decorating', lookup)).toMatchObject({ unit: null, concept: 'sprinkles' });
    expect(parseIngredient('2-3 sticks cinnamon', lookup).unit).toBeNull();
  });
});

describe('parseLine: lines naming two ingredients with their own amounts', () => {
  const lookup: Record<string, string> = {
    cornstarch: 'cornstarch', water: 'water', 'ground flax seed': 'flax', 'smoked paprika': 'paprika', 'garlic powder': 'garlic-powder', 'onion powder': 'onion-powder',
    salt: 'salt', pepper: 'pepper', juice: 'juice', garlic: 'garlic', cloves: 'clove-spice', 'spelt flour': 'spelt-flour', tamari: 'tamari', miso: 'miso', 'lemon juice': 'lemon-juice',
    'amido di mais': 'cornstarch', acqua: 'water', optional: 'term:optional'
  };
  const parts = (line: string, language = 'en') =>
    parseLine(line, lookup, language).map((p) => [p.quantity, p.unit, p.concept]);

  it.each([
    ['2 tsp cornstarch + 2 tbsp water', [[2, 'tsp', 'cornstarch'], [2, 'tbsp', 'water']]],
    ['2 teaspoons cornstarch mixed with 1 tablespoon water', [[2, 'tsp', 'cornstarch'], [1, 'tbsp', 'water']]],
    ['1 tbsp ground flax seed plus 3 tbsp water', [[1, 'tbsp', 'flax'], [3, 'tbsp', 'water']]],
    ['1 1/2 teaspoons salt and 1/4 teaspoon pepper', [[1.5, 'tsp', 'salt'], [0.25, 'tsp', 'pepper']]],
    ['1 cucchiaio di amido di mais e 2 cucchiai di acqua', [[1, 'tbsp', 'cornstarch'], [2, 'tbsp', 'water']], 'it'],
    // "each" shares one amount across a list: every item is a part with that amount.
    ['1/4 tsp each smoked paprika (, garlic powder)', [[0.25, 'tsp', 'paprika'], [0.25, 'tsp', 'garlic-powder']]],
    ['1/4 teaspoon each smoked paprika ( and garlic powder)', [[0.25, 'tsp', 'paprika'], [0.25, 'tsp', 'garlic-powder']]],
    ['1/2 teaspoon EACH garlic & onion powder', [[0.5, 'tsp', 'garlic-powder'], [0.5, 'tsp', 'onion-powder']]],
    ['1 tsp each salt, smoked paprika and garlic powder', [[1, 'tsp', 'salt'], [1, 'tsp', 'paprika'], [1, 'tsp', 'garlic-powder']]]
  ])('%s splits into its parts', (line, expected, language = 'en') => {
    expect(parts(line, language)).toEqual(expected);
  });

  it.each([
    // An added amount of the same ingredient is one measure, or a note.
    ['1 3/4 cups spelt flour + 2 tablespoons, divided', [[1.75, 'cup', 'spelt-flour']]],
    ['1/2 cup plus 2 tablespoons water', [[0.625, 'cup', 'water']]],
    // "+" binds to the alternative, so the line is not two purchases.
    ['1 tbsp tamari or 1 tsp miso + 2 tbsp water', [[1, 'tbsp', 'tamari']]],
    // A part vegdex does not know keeps the whole line together, as written.
    ['2 tsp cornstarch + 2 tbsp moon dust', [[2, 'tsp', null]]],
    ['1 cup water (+ 2 tbsp cornstarch)', [[1, 'cup', 'water']]],
    // A later part named by what it takes from the first is not a second purchase.
    ['2 tsp cornstarch + 2 tbsp juice', [[2, 'tsp', null]]],
    ['1 head garlic + 3 large cloves', [[1, 'head', 'garlic']]],
    ['1 tsp each salt, pepper and ½ tsp cornstarch', [[1, 'tsp', 'salt']]],
    // "each" inside an alternative or a note is not a shared amount.
    ['2 tsp smoked paprika (or use 1 tsp each of salt and pepper)', [[2, 'tsp', 'paprika']]]
  ])('%s stays one line', (line, expected) => {
    expect(parts(line)).toEqual(expected);
  });

  it('never reads a shared-amount list it cannot split as its first item alone', () => {
    const [line] = parseLine('1/4 tsp each salt, moon dust', lookup);
    expect(line!.concept).toBe('salt');
    expect(line!.conceptExact).toBe(false);
  });

  it('applies a label to every part', () => {
    const [first, second] = parseLine('Optional: 2 tsp smoked paprika + 1 tsp garlic powder', lookup);
    expect([first!.concept, second!.concept]).toEqual(['paprika', 'garlic-powder']);
    expect(second!.terms).toContainEqual({ id: 'term:optional', text: 'optional' });
  });
});
