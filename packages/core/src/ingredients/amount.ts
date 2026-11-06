import { lookupUnit, unitDef, UNIT_RE } from './units';
import { languageUnitPatterns, type LanguagePack } from '../languages';
import {
  AND_FRACTION_RE, QTY_RE, PLUS_MEASURE_RE, RANGE_TAIL_RE, CUT_SIZE_RE, SECOND_MEASURE_RE,
  UNIT_SIZE_RE, PIECE_SIZE_RE, PACK_SIZE_RE, COUNT_SIZE_RE, SLASH_ALT_RE, LATE_METRIC_RE,
  parseNumber, extractMetric, skipAltMeasure, stripMeasureWords
} from './measure';
import type { ParsedIngredient, UnitDef } from './types';
import type { Normalised } from './normalise';

export interface AmountResult {
  text: string; approx: boolean; leading: string[];
  // Resolution retries removed words to preserve legacy concept matches.
  written: string;
  quantity: number | null; quantityMax: number | null; unit: string | null;
  sizeNote: string; cutNote: string;
  metric: ParsedIngredient['metric']; afterMeasure: string | null;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twelve: 12, half: 0.5
};

/** "1-inch piece", "6- ounces": the hyphen joined the number to its unit. */
const HYPHEN_JOIN_RE = /^[-–]\s*(?=[\p{L}"”])/u;
/** "half a lemon", "1/2 a lemon": the article only introduces the amount. */
const ARTICLE_RE = /^(?:an?|the)\s+(?=\p{L})/iu;
/** "a few basil leaves": no amount, to taste. */
const FEW_RE = /^few\s+/i;
/** "70% dark chocolate": the percentage is detail, kept in the original. */
const PERCENT_RE = /\b\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*%\s*/;
/** "2 x 400 g / 14 oz canned tomatoes": a count of packages of a stated size. */
const TIMES_SIZE_RE = /^x\s*(\d+(?:[.,]\d+)?\s*(?:g|ml|oz|ounces?))(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:g|ml|oz|ounces?))?\s+/i;
/** "1 (15-ounce) can": a parenthetical size belongs to the container that follows. */
const PAREN_RE = /^\(([^)]*)\)\s*/;
/** "10 ounce package spinach": the weight is the size of the package. */
const CONTAINER_RE = /^(?:cans?|tins?|jars?|blocks?|bags?|packages?|packs?|packets?|cartons?|box(?:es)?|bottles?|tubs?|containers?|tubes?)\b\s*(?:of\s+)?/i;
/** "3/4 cup (180 ml) + 2 tablespoons": the bracket belongs to the first amount. */
const BRACKET_RE = /^\(([^()]*)\)\s*(?=(?:\+|plus\s))/i;
/** "pinch or two of", "1/2 teaspoon or so of". */
const OR_SO_RE = /^or\s+(?:two|so)\b\s*(?:of\s+)?/i;
/** "garlic cloves" written name-first: the clove becomes the unit and the name keeps only the garlic. */
const NAME_FIRST_CLOVE_RE = /^(?:(?:x-large|extra-large|large|medium|small|big|fat)\s+)?(garlic) cloves?\b/i;
const OF_ARTICLE_RE = /^of\s+(?:an?\s+)?/i;
/** "2-inch piece of ginger": the piece is the measure. */
const PIECE_OF_RE = /^(?:pieces?|knobs?|chunks?|slices?)\s+(?:of\s+)?(?=\p{L})/iu;
/** "1 package of 4 sausages": the count inside the package. */
const PACK_COUNT_RE = /^\d+\s+(?=\p{L})/u;
const EACH_OF_RE = /^each\s+(?:of\s+)?/i;
/** "1/3 tsp or more cumin": an amount left open-ended. */
const MORE_RE = /^(?:or|plus|\+)\s+more\s+/i;
/** A unit word with no amount when it names the measure ("a pinch of salt"). */
const COUNT_WORD_RE = /^(pinch|dash|handful|splash|sprinkle|bunch|sprig|can|tin|jar|bag|package|block|packet|sachet)/i;

/** Read the amount, leaving the remaining name text for the next stage. */
export function amount(input: Normalised, language: string, pack: LanguagePack): AmountResult {
  const initial: AmountResult = { text: input.text, approx: input.approx, leading: [...input.leading],
    written: '', quantity: null, quantityMax: null, unit: null, sizeNote: '', cutNote: '', metric: null, afterMeasure: null };
  const counted = { ...initial, ...readAmount(initial, pack) };
  const trimmed = { ...counted, ...trimAmountText(counted, language) };
  const sized = { ...trimmed, ...readSize(trimmed, language, pack) };
  const { altMeasure, ...measured } = { ...sized, ...readUnit(sized, language, pack) };
  const named = { ...measured, ...readOrSoAndClove(measured, language) };
  const metric = readMetric(named, altMeasure);
  return { ...named, ...metric, ...finishName(named, language, pack) };
}

function readAmount(input: Pick<AmountResult, 'text' | 'quantity' | 'quantityMax' | 'written' | 'approx'>, pack: LanguagePack) {
  let { text, quantity, quantityMax, written, approx } = input;
  const words = pack.numberWords ?? NUMBER_WORDS;
  const word = text.match(new RegExp(`^(${Object.keys(words).join('|')})\\s+`, 'i'));
  const q = text.match(QTY_RE);
  if (q) {
    quantity = parseNumber(q[1]!);
    quantityMax = q[2] ? parseNumber(q[2]) : null;
    text = text.slice(q[0].length);
    const more = text.match(AND_FRACTION_RE);
    if (more) {
      quantity += parseNumber(more[1]!);
      text = text.slice(more[0].length);
    }
    text = text.replace(HYPHEN_JOIN_RE, (m) => { written += m; return ''; });
  } else if (word) {
    quantity = words[word[1]!.toLowerCase()] ?? null;
    text = text.slice(word[0].length);
    // "a generous ¾ cup": the article only introduced the amount.
    const stripped = /^an?$/i.test(word[1]!) ? stripMeasureWords(text, pack) : null;
    const amount = stripped ? stripped.text.match(QTY_RE) : null;
    if (amount) {
      quantity = parseNumber(amount[1]!);
      quantityMax = amount[2] ? parseNumber(amount[2]) : null;
      approx ||= stripped!.approx;
      text = stripped!.text.slice(amount[0].length);
    }
  }
  return { quantity, quantityMax, text, written, approx };
}

function trimAmountText(input: Pick<AmountResult, 'quantity' | 'text' | 'quantityMax' | 'written' | 'leading'>, language: string) {
  let { quantity, text, quantityMax, written, leading } = input;
  leading = [...leading];
  if (quantity !== null && language === 'en') text = text.replace(ARTICLE_RE, '');
  // "a few basil leaves", "a few drops of rum extract": no amount, to taste.
  const few = language === 'en' && (quantity === null || quantity === 1) && quantityMax === null ? text.match(FEW_RE) : null;
  if (few) {
    written += few[0];
    text = text.slice(few[0].length);
    const fewUnit = text.match(UNIT_RE);
    // "a few cloves" names the cloves; "a few cloves of garlic" measures the garlic.
    if (fewUnit && lookupUnit(fewUnit[1]!)?.dimension === 'other' && /^(?:of\s+)?\p{L}/iu.test(text.slice(fewUnit[0].length))) {
      const of = text.slice(fewUnit[0].length).match(/^of\s+/i)?.[0] ?? '';
      written += fewUnit[0] + of;
      text = text.slice(fewUnit[0].length + of.length);
    }
    quantity = null;
    leading.push('to taste');
  }
  if (language === 'en') text = text.replace(PERCENT_RE, '');
  return { text, written, quantity, leading };
}

function readSize(input: Pick<AmountResult, 'text' | 'approx' | 'quantity' | 'sizeNote' | 'quantityMax'>, language: string, pack: LanguagePack) {
  let { text, approx, quantity, sizeNote, quantityMax } = input;
  const stripped = stripMeasureWords(text, pack);
  approx ||= stripped.approx;
  text = stripped.text.replace(UNIT_SIZE_RE, '');
  const times = quantity !== null ? text.match(TIMES_SIZE_RE) : null;
  if (times) {
    sizeNote = times[1]!;
    text = text.slice(times[0].length);
  }
  // A unit word reads as a unit after an amount; "Pizzico di sale" alone still means one pinch, "Foglioline di menta" is the name.
  if (pack.units) text = text.replace(languageUnitPatterns[language]!, (all, token: string) => (quantity !== null || pack.units![token.toLowerCase()] === 'pinch' ? `${pack.units![token.toLowerCase()]} ` : all));
  const size = times ? null : text.match(PAREN_RE) ?? text.match(PIECE_SIZE_RE) ?? text.match(PACK_SIZE_RE);
  if (size) {
    sizeNote = size[1]!;
    text = text.slice(size[0].length);
  }
  const counted = !size && !times && quantity !== null && quantityMax === null && language === 'en' ? text.match(COUNT_SIZE_RE) : null;
  if (counted) {
    quantity! *= parseNumber(counted[1]!);
    text = text.slice(counted[0].length);
  }
  return { approx, text, sizeNote, quantity };
}

/** Read the unit word and how it combines with the amount (fill, container, range, alternatives); returns the alternative measure. */
function readUnit(input: Pick<AmountResult, 'text' | 'quantity' | 'unit' | 'written' | 'leading' | 'quantityMax' | 'sizeNote'>, language: string, pack: LanguagePack) {
  let { text, quantity, unit, written, leading, quantityMax, sizeNote } = input;
  leading = [...leading];
  let altMeasure = '';
  const u = text.match(UNIT_RE);
  if (u && quantity !== null) {
    const def = lookupUnit(u[1]!);
    if (def) {
      unit = def.unit;
      if (def.dimension === 'other') written += u[0];
      text = text.slice(u[0].length);
      // "1 cucchiaino colmo di curry", "1 cucchiaio a testa di anacardi": how full, or per person, is a note.
      const fill = pack.fillNote ? text.match(pack.fillNote) : null;
      if (fill) {
        leading.push(fill[1]!.toLowerCase());
        text = text.slice(fill[0].length);
      }
      const container = (def.dimension === 'mass' || def.dimension === 'volume') && quantityMax === null && language === 'en'
        ? text.match(CONTAINER_RE) : null;
      if (container) {
        sizeNote ||= `${quantity} ${def.unit}`;
        unit = lookupUnit(container[0].trim().split(/\s/)[0]!)!.unit;
        quantity = 1;
        written += container[0];
        text = text.slice(container[0].length);
      }
      ({ text, quantityMax } = readRange(text, quantityMax, def));
      const alt = skipAltMeasure(text, def.dimension === 'mass' || def.dimension === 'volume');
      altMeasure = text.slice(0, text.length - alt.length);
      text = alt;
      const bracket = text.match(BRACKET_RE);
      if (bracket) {
        altMeasure ||= bracket[1]!;
        text = text.slice(bracket[0].length);
      }
      const plus = text.match(PLUS_MEASURE_RE);
      const plusUnit = plus ? text.slice(plus[0].length).match(UNIT_RE) : null;
      const plusDef = plusUnit ? lookupUnit(plusUnit[1]!) : undefined;
      if (plus && plusUnit && plusDef) {
        // Only same-dimension amounts add up; anything else is dropped rather than misread as the name.
        if (plusDef.dimension === def.dimension && def.dimension !== 'other') {
          const extra = (parseNumber(plus[1]!) * plusDef.factor) / def.factor;
          quantity += extra;
          if (quantityMax !== null) quantityMax += extra;
        }
        text = text.slice(plus[0].length + plusUnit[0].length);
        // "¼ cup + 2 tbsp / 90 ml".
        text = skipAltMeasure(text, false);
      }
      // "1 cup 180g rice": the second measure repeats the first; grams or ml are kept as its metric.
      const second = text.match(SECOND_MEASURE_RE);
      const secondUnit = second ? text.slice(second[0].length).match(UNIT_RE) : null;
      if (second && secondUnit && lookupUnit(secondUnit[1]!)) {
        altMeasure ||= text.slice(0, second[0].length + secondUnit[0].length);
        text = skipAltMeasure(text.slice(second[0].length + secondUnit[0].length), false);
      }
    }
  } else if (!u && quantity !== null && /^\/\s/.test(text)) {
    // "30-45 / 2-3 tbsp oil": the first amount has no unit, so the second measure is the one kept.
    const alt = text.match(SLASH_ALT_RE);
    const altUnit = alt ? text.slice(alt[0].length).match(UNIT_RE) : null;
    const altDef = altUnit ? lookupUnit(altUnit[1]!) : undefined;
    if (alt && altUnit && altDef) {
      quantity = parseNumber(alt[1]!);
      quantityMax = alt[2] ? parseNumber(alt[2]) : null;
      unit = altDef.unit;
      text = text.slice(alt[0].length + altUnit[0].length);
    }
  } else if (u && COUNT_WORD_RE.test(u[1]!)) {
    unit = lookupUnit(u[1]!)?.unit ?? null;
    quantity = 1;
    written += u[0];
    text = text.slice(u[0].length);
  }

  return { unit, written, text, sizeNote, quantity, quantityMax, leading, altMeasure };
}

function readOrSoAndClove(input: Pick<AmountResult, 'unit' | 'text' | 'approx' | 'quantity'>, language: string) {
  let { unit, text, approx, quantity } = input;
  const orSo = unit && language === 'en' ? text.match(OR_SO_RE) : null;
  if (orSo) {
    approx = true;
    text = text.slice(orSo[0].length);
  }

  // "garlic cloves" written name-first. The clove becomes the unit and the name keeps only the garlic.
  const nameFirstClove = !unit && quantity !== null ? text.match(NAME_FIRST_CLOVE_RE) : null;
  if (nameFirstClove) {
    unit = 'clove';
    text = nameFirstClove[1]! + text.slice(nameFirstClove[0].length);
  }
  return { approx, text, unit };
}

function readMetric(input: Pick<AmountResult, 'text' | 'unit' | 'sizeNote' | 'quantity'>, altMeasure: string) {
  const { text, unit, sizeNote, quantity } = input;
  const paren = text.match(PAREN_RE);
  const parenMetric = paren ? extractMetric(paren[1]!) : null;
  const metricSource = altMeasure || (unit && ['cup', 'tbsp', 'tsp', 'oz', 'lb'].includes(unit) ? sizeNote : '');
  let metric = parenMetric ?? (metricSource ? extractMetric(metricSource) : null);
  let afterMeasure = unit ? (parenMetric ? text.slice(paren![0].length) : text) : null;
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
  return { metric, afterMeasure };
}

function finishName(input: Pick<AmountResult, 'text' | 'written' | 'unit' | 'cutNote' | 'leading'>, language: string, pack: LanguagePack) {
  let { text, written, unit, cutNote, leading } = input;
  leading = [...leading];
  // A leading parenthetical already read as a metric amount is dropped before the name.
  text = text.replace(PAREN_RE, '').replace(OF_ARTICLE_RE, (m) => { if (written) written += m; return ''; });
  const cut = unit && language === 'en' ? text.match(CUT_SIZE_RE) : null;
  if (cut) {
    cutNote = cut[1]!;
    text = text.slice(cut[0].length);
  }
  if (unit && ['inch', 'cm'].includes(unit) && language === 'en') text = text.replace(PIECE_OF_RE, (m) => { written += m; return ''; });
  if (unit && ['package', 'bag', 'box', 'can', 'jar', 'container'].includes(unit) && language === 'en') text = text.replace(PACK_COUNT_RE, '');
  if (pack.preposition) text = text.replace(pack.preposition, '');
  // "½ tsp each salt & pepper", "1/3 tsp or more cumin": amounts shared or open-ended.
  text = text.replace(EACH_OF_RE, '');
  const more = language === 'en' ? text.match(MORE_RE) : null;
  if (more) {
    text = text.slice(more[0].length);
    leading.push('as needed');
  }
  return { text, written, cutNote, leading };
}

function readRange(text: string, quantityMax: number | null, def: UnitDef) {
  const range = text.match(RANGE_TAIL_RE);
  const rangeUnit = range ? text.slice(range[0].length).match(UNIT_RE) : null;
  const rangeDef = rangeUnit ? lookupUnit(rangeUnit[1]!) : undefined;
  if (range && rangeDef && (rangeDef.unit === def.unit || (rangeDef.dimension === def.dimension && def.dimension !== 'other'))) {
    quantityMax = (parseNumber(range[1]!) * rangeDef.factor) / def.factor;
    text = text.slice(range[0].length + rangeUnit![0].length);
  }
  return { text, quantityMax };
}
