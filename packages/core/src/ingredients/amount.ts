import { lookupUnit, unitDef, UNIT_RE } from './units';
import { languageUnitPatterns, type LanguagePack } from '../languages';
import {
  AND_FRACTION_RE, QTY_RE, PLUS_MEASURE_RE, RANGE_TAIL_RE, CUT_SIZE_RE, SECOND_MEASURE_RE,
  UNIT_SIZE_RE, PIECE_SIZE_RE, PACK_SIZE_RE, COUNT_SIZE_RE, SLASH_ALT_RE, LATE_METRIC_RE,
  parseNumber, extractMetric, skipAltMeasure, stripMeasureWords
} from './measure';
import type { ParseState } from './types';

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
/** A leading parenthetical already read as a metric amount is dropped before the name. */
const PAREN_STRIP_RE = /^\([^)]*\)\s*/;
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

/** Read the amount: quantity, range and unit, leaving the name in `state.text`. */
export function amount(state: ParseState, language: string, pack: LanguagePack): void {
  readAmount(state, pack);
  trimAmountText(state, language);
  readSize(state, language, pack);
  const altMeasure = readUnit(state, language, pack);
  readOrSoAndClove(state, language);
  readMetric(state, altMeasure);
  finishName(state, language, pack);
}

function readAmount(state: ParseState, pack: LanguagePack): void {
  const words = pack.numberWords ?? NUMBER_WORDS;
  const word = state.text.match(new RegExp(`^(${Object.keys(words).join('|')})\\s+`, 'i'));
  const q = state.text.match(QTY_RE);
  if (q) {
    state.quantity = parseNumber(q[1]!);
    state.quantityMax = q[2] ? parseNumber(q[2]) : null;
    state.text = state.text.slice(q[0].length);
    const more = state.text.match(AND_FRACTION_RE);
    if (more) {
      state.quantity += parseNumber(more[1]!);
      state.text = state.text.slice(more[0].length);
    }
    state.text = state.text.replace(HYPHEN_JOIN_RE, (m) => { state.written += m; return ''; });
  } else if (word) {
    state.quantity = words[word[1]!.toLowerCase()] ?? null;
    state.text = state.text.slice(word[0].length);
    // "a generous ¾ cup": the article only introduced the amount.
    const stripped = /^an?$/i.test(word[1]!) ? stripMeasureWords(state.text, pack) : null;
    const amount = stripped ? stripped.text.match(QTY_RE) : null;
    if (amount) {
      state.quantity = parseNumber(amount[1]!);
      state.quantityMax = amount[2] ? parseNumber(amount[2]) : null;
      state.approx ||= stripped!.approx;
      state.text = stripped!.text.slice(amount[0].length);
    }
  }
}

function trimAmountText(state: ParseState, language: string): void {
  if (state.quantity !== null && language === 'en') state.text = state.text.replace(ARTICLE_RE, '');
  // "a few basil leaves", "a few drops of rum extract": no amount, to taste.
  const few = language === 'en' && (state.quantity === null || state.quantity === 1) && state.quantityMax === null ? state.text.match(FEW_RE) : null;
  if (few) {
    state.written += few[0];
    state.text = state.text.slice(few[0].length);
    const fewUnit = state.text.match(UNIT_RE);
    // "a few cloves" names the cloves; "a few cloves of garlic" measures the garlic.
    if (fewUnit && lookupUnit(fewUnit[1]!)?.dimension === 'other' && /^(?:of\s+)?\p{L}/iu.test(state.text.slice(fewUnit[0].length))) {
      const of = state.text.slice(fewUnit[0].length).match(/^of\s+/i)?.[0] ?? '';
      state.written += fewUnit[0] + of;
      state.text = state.text.slice(fewUnit[0].length + of.length);
    }
    state.quantity = null;
    state.leading.push('to taste');
  }
  if (language === 'en') state.text = state.text.replace(PERCENT_RE, '');
}

function readSize(state: ParseState, language: string, pack: LanguagePack): void {
  const stripped = stripMeasureWords(state.text, pack);
  state.approx ||= stripped.approx;
  state.text = stripped.text.replace(UNIT_SIZE_RE, '');
  const times = state.quantity !== null ? state.text.match(TIMES_SIZE_RE) : null;
  if (times) {
    state.sizeNote = times[1]!;
    state.text = state.text.slice(times[0].length);
  }
  // A unit word reads as a unit after an amount; "Pizzico di sale" alone still means one pinch, "Foglioline di menta" is the name.
  if (pack.units) state.text = state.text.replace(languageUnitPatterns[language]!, (all, token: string) => (state.quantity !== null || pack.units![token.toLowerCase()] === 'pinch' ? `${pack.units![token.toLowerCase()]} ` : all));
  const size = times ? null : state.text.match(PAREN_RE) ?? state.text.match(PIECE_SIZE_RE) ?? state.text.match(PACK_SIZE_RE);
  if (size) {
    state.sizeNote = size[1]!;
    state.text = state.text.slice(size[0].length);
  }
  const counted = !size && !times && state.quantity !== null && state.quantityMax === null && language === 'en' ? state.text.match(COUNT_SIZE_RE) : null;
  if (counted) {
    state.quantity! *= parseNumber(counted[1]!);
    state.text = state.text.slice(counted[0].length);
  }
}

/** Read the unit word and how it combines with the amount (fill, container, range, alternatives); returns the alternative measure. */
function readUnit(state: ParseState, language: string, pack: LanguagePack): string {
  let altMeasure = '';
  const u = state.text.match(UNIT_RE);
  if (u && state.quantity !== null) {
    const def = lookupUnit(u[1]!);
    if (def) {
      state.unit = def.unit;
      if (def.dimension === 'other') state.written += u[0];
      state.text = state.text.slice(u[0].length);
      // "1 cucchiaino colmo di curry", "1 cucchiaio a testa di anacardi": how full, or per person, is a note.
      const fill = pack.fillNote ? state.text.match(pack.fillNote) : null;
      if (fill) {
        state.leading.push(fill[1]!.toLowerCase());
        state.text = state.text.slice(fill[0].length);
      }
      const container = (def.dimension === 'mass' || def.dimension === 'volume') && state.quantityMax === null && !altMeasure && language === 'en'
        ? state.text.match(CONTAINER_RE) : null;
      if (container) {
        state.sizeNote ||= `${state.quantity} ${def.unit}`;
        state.unit = lookupUnit(container[0].trim().split(/\s/)[0]!)!.unit;
        state.quantity = 1;
        state.written += container[0];
        state.text = state.text.slice(container[0].length);
      }
      const range = state.text.match(RANGE_TAIL_RE);
      const rangeUnit = range ? state.text.slice(range[0].length).match(UNIT_RE) : null;
      const rangeDef = rangeUnit ? lookupUnit(rangeUnit[1]!) : undefined;
      if (range && rangeDef && (rangeDef.unit === def.unit || (rangeDef.dimension === def.dimension && def.dimension !== 'other'))) {
        state.quantityMax = (parseNumber(range[1]!) * rangeDef.factor) / def.factor;
        state.text = state.text.slice(range[0].length + rangeUnit![0].length);
      }
      const alt = skipAltMeasure(state.text, def.dimension === 'mass' || def.dimension === 'volume');
      altMeasure = state.text.slice(0, state.text.length - alt.length);
      state.text = alt;
      const bracket = state.text.match(BRACKET_RE);
      if (bracket) {
        altMeasure ||= bracket[1]!;
        state.text = state.text.slice(bracket[0].length);
      }
      const plus = state.text.match(PLUS_MEASURE_RE);
      const plusUnit = plus ? state.text.slice(plus[0].length).match(UNIT_RE) : null;
      const plusDef = plusUnit ? lookupUnit(plusUnit[1]!) : undefined;
      if (plus && plusUnit && plusDef) {
        // Only same-dimension amounts add up; anything else is dropped rather than misread as the name.
        if (plusDef.dimension === def.dimension && def.dimension !== 'other') {
          const extra = (parseNumber(plus[1]!) * plusDef.factor) / def.factor;
          state.quantity += extra;
          if (state.quantityMax !== null) state.quantityMax += extra;
        }
        state.text = state.text.slice(plus[0].length + plusUnit[0].length);
        // "¼ cup + 2 tbsp / 90 ml".
        state.text = skipAltMeasure(state.text, false);
      }
      // "1 cup 180g rice": the second measure repeats the first; grams or ml are kept as its metric.
      const second = state.text.match(SECOND_MEASURE_RE);
      const secondUnit = second ? state.text.slice(second[0].length).match(UNIT_RE) : null;
      if (second && secondUnit && lookupUnit(secondUnit[1]!)) {
        altMeasure ||= state.text.slice(0, second[0].length + secondUnit[0].length);
        state.text = skipAltMeasure(state.text.slice(second[0].length + secondUnit[0].length), false);
      }
    }
  } else if (!u && state.quantity !== null && /^\/\s/.test(state.text)) {
    // "30-45 / 2-3 tbsp oil": the first amount has no unit, so the second measure is the one kept.
    const alt = state.text.match(SLASH_ALT_RE);
    const altUnit = alt ? state.text.slice(alt[0].length).match(UNIT_RE) : null;
    const altDef = altUnit ? lookupUnit(altUnit[1]!) : undefined;
    if (alt && altUnit && altDef) {
      state.quantity = parseNumber(alt[1]!);
      state.quantityMax = alt[2] ? parseNumber(alt[2]) : null;
      state.unit = altDef.unit;
      state.text = state.text.slice(alt[0].length + altUnit[0].length);
    }
  } else if (u && COUNT_WORD_RE.test(u[1]!)) {
    state.unit = lookupUnit(u[1]!)?.unit ?? null;
    state.quantity = 1;
    state.written += u[0];
    state.text = state.text.slice(u[0].length);
  }
  return altMeasure;
}

function readOrSoAndClove(state: ParseState, language: string): void {
  const orSo = state.unit && language === 'en' ? state.text.match(OR_SO_RE) : null;
  if (orSo) {
    state.approx = true;
    state.text = state.text.slice(orSo[0].length);
  }

  // "garlic cloves" written name-first. The clove becomes the unit and the name keeps only the garlic.
  const nameFirstClove = !state.unit && state.quantity !== null ? state.text.match(NAME_FIRST_CLOVE_RE) : null;
  if (nameFirstClove) {
    state.unit = 'clove';
    state.text = nameFirstClove[1]! + state.text.slice(nameFirstClove[0].length);
  }
}

function readMetric(state: ParseState, altMeasure: string): void {
  const paren = state.text.match(PAREN_RE);
  const parenMetric = paren ? extractMetric(paren[1]!) : null;
  const metricSource = altMeasure || (state.unit && ['cup', 'tbsp', 'tsp', 'oz', 'lb'].includes(state.unit) ? state.sizeNote : '');
  let metric = parenMetric ?? (metricSource ? extractMetric(metricSource) : null);
  let afterMeasure = state.unit ? (parenMetric ? state.text.slice(paren![0].length) : state.text) : null;
  // "2 cups flour (280g)": a parenthetical that is only a metric amount, after the name.
  const dim = state.unit ? unitDef(state.unit)?.dimension : undefined;
  const lateMetric = !metric && afterMeasure && (dim === 'volume' || dim === 'mass') ? afterMeasure.match(LATE_METRIC_RE) : null;
  if (lateMetric) {
    metric = extractMetric(lateMetric[2]!);
    const words = lateMetric[1]!.replace(/^\s*(?:about|approx\.?|~)?\s*$/i, '').trim();
    afterMeasure = afterMeasure!.replace(lateMetric[0], words ? `(${words})` : ' ').replace(/\s+([,)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }
  if (state.unit && (state.unit === 'g' || state.unit === 'kg') && state.quantity !== null)
    metric = { quantity: state.quantity * (state.unit === 'kg' ? 1000 : 1), unit: 'g' };
  if (state.unit && (state.unit === 'ml' || state.unit === 'l') && state.quantity !== null)
    metric = { quantity: state.quantity * (state.unit === 'l' ? 1000 : 1), unit: 'ml' };
  state.metric = metric;
  state.afterMeasure = afterMeasure;
}

function finishName(state: ParseState, language: string, pack: LanguagePack): void {
  state.text = state.text.replace(PAREN_STRIP_RE, '').replace(OF_ARTICLE_RE, (m) => { if (state.written) state.written += m; return ''; });
  const cut = state.unit && language === 'en' ? state.text.match(CUT_SIZE_RE) : null;
  if (cut) {
    state.cutNote = cut[1]!;
    state.text = state.text.slice(cut[0].length);
  }
  if (state.unit && ['inch', 'cm'].includes(state.unit) && language === 'en') state.text = state.text.replace(PIECE_OF_RE, (m) => { state.written += m; return ''; });
  if (state.unit && ['package', 'bag', 'box', 'can', 'jar', 'container'].includes(state.unit) && language === 'en') state.text = state.text.replace(PACK_COUNT_RE, '');
  if (pack.preposition) state.text = state.text.replace(pack.preposition, '');
  // "½ tsp each salt & pepper", "1/3 tsp or more cumin": amounts shared or open-ended.
  state.text = state.text.replace(EACH_OF_RE, '');
  const more = language === 'en' ? state.text.match(MORE_RE) : null;
  if (more) {
    state.text = state.text.slice(more[0].length);
    state.leading.push('as needed');
  }
}
