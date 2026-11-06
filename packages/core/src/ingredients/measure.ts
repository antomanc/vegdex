import { lookupUnit, UNIT_PATTERN, UNIT_RE } from './units';
import type { LanguagePack } from '../languages';
import type { ParsedIngredient } from './types';

const NUM = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?`;
export const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to|or)\s*(${NUM}))?\s*`);
/** "1 and 1/2", "1/4 + 1/8": a fraction added to the quantity before the unit. */
export const AND_FRACTION_RE = /^(?:and|\+)\s*(\d+\/\d+)\s*/;
const SUM = String.raw`(?:${NUM})(?:\s*(?:and|\+)\s*\d+\/\d+)?`;
/** "60 ml / ¼ cup": the second, alternative measure of a dual measure. */
const ALT_MEASURE_RE = new RegExp(String.raw`^\/\s*(?:(?:heaped|heaping|packed|scant|generous|level|about|approx\.?|approximately|around|(?:just|a little|a bit) (?:under|over)|~)\s*)?(?:${SUM})(?:\s*(?:-|–|to)\s*(?:${NUM}))?\s*`, 'i');
/** "½ cup + 2 tbsp": a second amount added to the first. */
export const PLUS_MEASURE_RE = new RegExp(String.raw`^(?:\+|plus\s|and\s)\s*(${NUM})(?:\s*(?:-|–|to|or)\s*(?:${NUM}))?\s*`, 'i');
/** "½ cup – 1 cup milk", "½ teaspoon to 2 teaspoons": the top of a range written with its own unit. */
export const RANGE_TAIL_RE = new RegExp(String.raw`^(?:-|–|to)\s*(${NUM})\s*`, 'i');
/** "1/4 inch sliced carrots", "1/2-inch chunks of": the size of the cut, kept as a note. */
export const CUT_SIZE_RE = new RegExp(String.raw`^((?:${NUM})(?:\s*(?:-|–|to)\s*(?:${NUM}))?\s*-?\s*(?:inch(?:es)?|in\.|cm|"|”)(?:\s+(?:wide|thick|long))?(?:\s+(?:chunks?|pieces?|cubes?|dice|slices?|rounds?))?)\s+(?:of\s+)?`, 'i');
/** "1 cup 180g rice", "2 tablespoons 30 ml water": a second measure written straight after the first. */
export const SECOND_MEASURE_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–)\s*(?:${NUM}))?\s*(?:an?\s+)?`);
/** How full the spoon or cup is: says nothing about what to buy. */
const MEASURE_WORD = String.raw`heaped|heaping|packed|loosely|lightly|firmly|scant|generous|rounded|level|approx\.?|approximately|about|around`;
const MEASURE_WORDS_RE = new RegExp(`^(?:(?:${MEASURE_WORD})\\s+)+`, 'i');
export const MEASURE_QUALIFIERS_RE = new RegExp(`\\b(?:${MEASURE_WORD})\\b`, 'gi');
const APPROX_RE = /\b(?:approx\.?|approximately|about|around)\b/i;
export const FILL_QUALIFIERS_RE = /\b(?:heaped|heaping|packed|loosely|lightly|firmly|scant|generous|rounded|level)\b/gi;
/** "1 large handful": a size before a unit describes the unit, not the ingredient. */
export const UNIT_SIZE_RE = /^(?:x-large|extra-large|large|medium|small|big|fat|good|healthy|hearty)\s+(?=(?:handfuls?|heads?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|splash(?:es)?|sprinkles?|cans?|tins?|jars?|blocks?|bags?|packages?|sprigs?|stalks?|slices?|pieces?|scoops?|cloves?)\b)/i;
/** "3-inch piece", "2 cm piece": the size of a piece, kept as a note. */
export const PIECE_SIZE_RE = /^(\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?\s*-?\s*(?:inch|in\.|cm|"|”))\s*/i;
/** "1 15 oz can": the size of the can, jar or block, kept as a note. */
export const PACK_SIZE_RE = /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*-?\s*(?:oz\.?|ounces?|g|grams?|ml|lbs?\.?|pounds?))\s*(?:[([][^)\]]*[)\]]\s*)?(?=(?:cans?|tins?|jars?|blocks?|bags?|packages?|packs?|packets?|cartons?|canned|box(?:es)?|bottles?|tubs?|containers?|tubes?|bars?)\b)/i;
/** "1 14 ounce artichoke hearts", "one 4oz butter stick": a count of packages whose size is the measure. */
export const COUNT_SIZE_RE = /^(\d+(?:[.,]\d+)?)\s*-?\s*(?=(?:oz\.?|ounces?|g|grams?|ml|lbs?\.?|pounds?)(?![\p{L}]))/iu;
/** "water + 2 tablespoons", "soy milk + 1 tbsp for brushing": an extra amount at the end of the name. */
export const TRAILING_EXTRA_RE = new RegExp(String.raw`\s+(?:\+|plus)\s*(?:(?:${NUM})\s*(?:${UNIT_PATTERN})\.?(?=\s+(?:for|to|as|if)\b|\s*[,;(]|\s*$))`, 'i');
/** "or 8 slices of", "and 1/4 teaspoon": the amount of a second ingredient inside the name. */
export const ALT_AMOUNT_RE = new RegExp(String.raw`\s+or\s+(?:${NUM}).*$`, 'i');
const SIZE_WORD = 'x-large|extra-large|large|medium|small|big';
/** "2 small or 1 large peppers": the first size goes with the amount. */
export const ALT_SIZE_RE = new RegExp(String.raw`^(${SIZE_WORD})\s+or\s+(?:(?:${NUM})\s+)?(?:${SIZE_WORD})\s+`, 'i');
/** "30-45 / 2-3 tbsp oil": the first amount has no unit, so the second measure is the one kept. */
export const SLASH_ALT_RE = new RegExp(String.raw`^\/\s*(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*`);
/** "(280g)", "(packed – 150g)": a metric amount closing a parenthetical whose words carry no other number. */
export const LATE_METRIC_RE = /\(([^()\d]{0,30}?)[\s,;:–—-]*(?:~|about\s+)?(\d+(?:[.,]\d+)?\s*(?:g|grams?|kg|ml|mL|milliliters?|l|liters?))\s*\)/i;
const METRIC_RE = /(\d+(?:[.,]\d+)?)\s*(g|grams?|kg|ml|mL|milliliters?|l|liters?)\b/i;

export function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

export function extractMetric(text: string): ParsedIngredient['metric'] {
  const m = text.match(METRIC_RE);
  if (!m) return null;
  const q = Number(m[1]!.replace(',', '.'));
  const u = m[2]!.toLowerCase();
  if (u === 'kg') return { quantity: q * 1000, unit: 'g' };
  if (u === 'l' || u.startsWith('liter')) return { quantity: q * 1000, unit: 'ml' };
  if (u.startsWith('g')) return { quantity: q, unit: 'g' };
  return { quantity: q, unit: 'ml' };
}

/** Drop the alternative sides of "60 ml / ¼ cup / 4 tbsp" (or "75 g / 10 apricots" after a weight); the first measure is the one kept. */
export function skipAltMeasure(s: string, countOk: boolean): string {
  const alt = s.match(ALT_MEASURE_RE);
  if (!alt) return s;
  const rest = s.slice(alt[0].length).replace(MEASURE_WORDS_RE, '');
  const u = rest.match(UNIT_RE);
  if (u && lookupUnit(u[1]!)) return skipAltMeasure(rest.slice(u[0].length), countOk);
  return countOk && /^\p{L}/u.test(rest) ? rest : s;
}

/** Strip "~", the language's "about" and measure qualifiers from the front of an amount, reporting an approximate one. */
export function stripMeasureWords(input: string, pack: LanguagePack): { text: string; approx: boolean } {
  let text = input;
  let approx = false;
  // "~1/3 cup".
  const tilde = text.match(/^~\s*/);
  if (tilde) {
    approx = true;
    text = text.slice(tilde[0].length);
  }
  // "circa 1 litro d'acqua".
  const circa = pack.circa ? text.match(pack.circa) : null;
  if (circa) {
    approx = true;
    text = text.slice(circa[0].length);
  }
  const m = text.match(MEASURE_WORDS_RE);
  if (m && APPROX_RE.test(m[0])) approx = true;
  return { text: m ? text.slice(m[0].length) : text, approx };
}
