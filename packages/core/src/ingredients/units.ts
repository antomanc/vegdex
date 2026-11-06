import type { UnitDef } from './types';

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
export function lookupUnit(token: string): UnitDef | undefined {
  if (token === 'T' || token === 't') return UNIT_LOOKUP.get(token);
  return UNIT_LOOKUP.get(token.toLowerCase());
}

export const UNIT_PATTERN = [...UNIT_LOOKUP.keys()]
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&'))
  .join('|');
export const UNIT_RE = new RegExp(`^(${UNIT_PATTERN})(?![a-z])\\.?\\s*`, 'i');
