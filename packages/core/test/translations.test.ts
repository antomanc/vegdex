import { expect, it } from 'vitest';
import { safeTranslation } from '../src/index';

it('falls back when a translated title names an unqualified animal ingredient', () => {
  for (const [language, unsafe] of [
    ['it', 'Pancake al burro'], ['it', 'Pasta con pollo'], ['it', 'Burro vegano e uova'],
    ['it', 'Formaggio vegano con latte'], ['en', 'Vegan butter and eggs'], ['en', 'Tofu with chicken'],
    ['en', 'Cheese and vegan butter'], ['en', 'Vegan cheese with milk'], ['it', 'Pasta con parmigiano'],
    ['it', 'Salsa di acciughe'], ['it', 'Dolce con miele'], ['en', 'Quark Bowl']
  ]) expect(safeTranslation('Original vegan recipe', unsafe, language!)).toBe('Original vegan recipe');
});

it('allows qualifiers belonging to the ingredient and plant names that contain animal words', () => {
  for (const [language, safe] of [
    ['it', 'Burro vegano'], ['it', 'Formaggio vegetale'], ['it', 'Latte di mandorla'],
    ['it', 'Burro di arachidi'], ['it', 'Yogurt di soia'], ['it', 'Pancake vegani soffici'], ['it', "Latte d'avena"], ['it', 'Burro d’arachidi'],
    ['en', 'Vegan butter'], ['en', 'Plant-based milk'], ['en', 'Almond milk'],
    ['en', 'Peanut butter'], ['en', 'Flax eggs'], ['en', 'Mushroom cream'], ['en', 'Butter beans']
  ]) expect(safeTranslation('Original', safe, language!)).toBe(safe);
  for (const candidate of [undefined, null, {}, 42, '', '  '])
    expect(safeTranslation('Original', candidate, 'it')).toBe('Original');
  expect(safeTranslation('Original', 'Piatto sicuro', 'xx')).toBe('Original');
});

it('does not reuse one qualifier for two adjacent animal ingredients', () => {
  expect(safeTranslation('Original', 'Burro vegano latte', 'it')).toBe('Original');
  expect(safeTranslation('Original', 'Burro vegano e latte vegetale', 'it')).toBe('Burro vegano e latte vegetale');
});

it('rejects plural forms of Italian meats and fish, which agreeing names now produce', () => {
  for (const text of ['polli', 'maiali', 'agnelli', 'tacchini', 'vitelli', 'anatre', 'conigli', 'salami', 'tonni', 'salmoni', 'merluzzi', 'pesci', 'prosciutti'])
    expect(safeTranslation('Original', `Pasta con ${text}`, 'it'), text).toBe('Original');
  expect(safeTranslation('Original', 'Pesche sciroppate', 'it')).toBe('Pesche sciroppate');
});

it('rejects common Italian shellfish forms and unrelated plant words', () => {
  for (const text of ['gamberetti', 'gamberetto', 'capesante', 'capasanta', 'granchi', 'calamaro', 'aragoste', 'ostrica', 'vongola', 'cozza'])
    expect(safeTranslation('Original', `Pasta con ${text}`, 'it')).toBe('Original');
  for (const text of ['Chicken beans', 'Peanut chicken', 'Honey mushrooms', 'Milk lettuce'])
    expect(safeTranslation('Original', text, 'en')).toBe('Original');
  expect(safeTranslation('Original', 'Oyster mushrooms', 'en')).toBe('Oyster mushrooms');
});

it('guards common named cheeses and meats in each display language without borrowing another qualifier', () => {
  for (const [language, names] of [
    ['it', ['cheddar', 'gorgonzola', 'brie', 'gouda', 'gruyère', 'emmental', 'provolone', 'fontina', 'burrata', 'stracchino', 'guanciale', 'mortadella', 'bresaola', 'coniglio', 'lardo', 'speck', 'würstel', 'polpo', 'seppie', 'baccalà', 'trota', 'frutti di mare', 'carni', 'cacio', 'kefir', 'sardina', 'latticello', 'maionese']],
    ['en', ['gorgonzola', 'brie', 'gouda', 'gruyère', 'halloumi', 'paneer', 'salami', 'pepperoni', 'chorizo', 'venison', 'rabbit', 'buttermilk', 'kefir', 'mayonnaise', 'trout', 'octopus', 'seafood', 'worcestershire sauce']]
  ] as const) {
    for (const name of names) {
      expect(safeTranslation('Original vegan recipe', name, language), name).toBe('Original vegan recipe');
      const qualified = language === 'it' ? `${name} vegetale` : `vegan ${name}`;
      expect(safeTranslation('Original', qualified, language)).toBe(qualified);
    }
  }
  expect(safeTranslation('Original', 'Cheddar vegano e gorgonzola', 'it')).toBe('Original');
  expect(safeTranslation('Original', 'Vegan gorgonzola with salami', 'en')).toBe('Original');
});

it('accepts a qualifier anywhere in the same ingredient, once, and a cheese name followed by "cheese"', () => {
  for (const safe of ['vegan ground beef', 'dairy free butter', 'dairy-free butter', 'vegan heavy cream', 'vegan cheddar cheese', 'shredded vegan mozzarella cheese', 'non-dairy whipped cream', 'meatless sausage', 'sunflower seed butter', 'coconut whipped cream', 'apple butter', 'dairy-free cream cheese', 'flax “eggs”'])
    expect(safeTranslation('Original', safe, 'en'), safe).toBe(safe);
  for (const unsafe of ['vegan cheddar bacon', 'vegan butter cheese chicken', 'ground beef', 'cheddar cheese', 'vegan butter and cheese'])
    expect(safeTranslation('Original', unsafe, 'en'), unsafe).toBe('Original');
  for (const safe of ['carne macinata vegetale', 'panna da cucina vegetale', 'formaggio grattugiato vegano', 'Pancetta di tofu affumicata',
    'Feta al tofu', 'Panna montata al cocco', 'Pollo fritto al tofu', 'Burrito vegani in stile manzo', 'Insalata di ceci tipo tonno',
    'Pane alla banana senza uova', 'Biscotti senza burro', 'Funghi ostrica saltati'])
    expect(safeTranslation('Original', safe, 'it'), safe).toBe(safe);
  for (const unsafe of ['carne macinata di manzo', 'panna da cucina fresca e intera', 'Pollo e gnocchi vegani', 'Pollo al burro vegano', 'Tonno di mare'])
    expect(safeTranslation('Original', unsafe, 'it'), unsafe).toBe('Original');
});
