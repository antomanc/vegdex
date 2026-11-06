import { hasDroppedMeasureWords, type ParsedIngredient } from './ingredients';
import { languagePacks } from './languages';
import { findUnsafeRenderedTerms, safeTranslation } from './translations';
import type { GroceryItem } from './grocery';
import { exactMetric, formatMetric, toMetric, type Units } from './metric';
import { isPoured } from './weights';
import { formatAmount, formatAmountRange, nounForm, termForm, type LanguageVocabulary, type NounForms } from './vocabulary';

const METRIC_UNITS = new Set(['g', 'kg', 'ml', 'l']);
/** How a cup was filled: nothing to say once the amount is in grams or ml. */
const CUP_FILL = new Set(['term:packed', 'term:spooned-and-leveled']);

/** Lines that are not ingredients never show; a heading shows only in the language it was written in. */
export function isHiddenLine(p: ParsedIngredient | undefined, language: string, source = 'en'): boolean {
  return p?.kind === 'other' || (p?.kind === 'heading' && language !== source);
}

/**
 * One ingredient line in `language`, as [amount, name and preparation]; commentary is left out.
 * In the recipe's own language the name and preparation keep their written words. In another language
 * every part comes from the vocabulary, or the line is null and the caller keeps the original as written.
 */
export function renderIngredient(
  p: ParsedIngredient, vocab: LanguageVocabulary | undefined, language: string, units: Units, source = 'en'
): [amount: string, rest: string] | null {
  const pack = languagePacks[language];
  if (!vocab || !pack || !p.terms || p.phrase === undefined || !p.name || p.kind) return null;
  // A name after a parenthesized weight may have been parsed as commentary: keep the whole source line.
  if (p.concept && p.conceptExact === false && !p.phrase.toLowerCase().includes(p.name.toLowerCase())) return null;
  const metric = units === 'metric' ? toMetric(p) : null;
  // "⅓ packed cup (50g)": how full the cup is matters only while the cup is the measure.
  const weighedExactly = !!metric && p.metric?.unit === metric.unit;
  if (hasDroppedMeasureWords(p) && !weighedExactly) return null;
  const same = language === source;
  const number = new Intl.NumberFormat(language, { useGrouping: false, maximumFractionDigits: 10 });
  const label = (unit: string, quantity: number) => vocab.units[unit]?.[quantity <= 1 ? 0 : 1];

  let amount = '';
  let linked = false;
  if (metric) {
    amount = formatMetric(metric, exactMetric(p, metric)).replace(/\d+(?:\.\d+)?/g, (n) => number.format(Number(n)));
    linked = true;
  } else if (p.quantity !== null) {
    amount = formatAmountRange(p.quantity, p.quantityMax, language);
    if (p.unit) {
      // A dash of pepper is a pinch; a dash of hot sauce is a splash.
      const unit = label(p.unit === 'dash' && !isPoured(p.densityName ?? p.name) ? 'pinch' : p.unit, p.quantityMax ?? p.quantity);
      if (!unit) return null;
      amount += ` ${unit}`;
      linked = true;
    }
    if (p.size) {
      const unit = label(p.size.unit, p.size.quantity);
      if (!unit) return null;
      amount += ` (${formatAmount(p.size.quantity, language)} ${unit})`;
    }
    // One bracket per amount: "2 cans (400 g)" already says it, and a second one reads as a different size.
    if (p.metric && !p.size && p.unit && !METRIC_UNITS.has(p.unit)) amount += ` (${number.format(p.metric.quantity)}${p.metric.quantityMax !== undefined ? '–' + number.format(p.metric.quantityMax) : ''} ${p.metric.unit})`;
    if (p.approx) amount = `${pack.about} ${amount}`;
  }
  if (metric && p.approx && !amount.startsWith('≈')) amount = `≈ ${amount}`;

  const measured = !!metric || !!p.unit;
  let name = p.phrase;
  let forms: NounForms | undefined;
  let plural = false;
  if (!same) {
    if (!p.concept || p.conceptExact !== true) return null;
    forms = vocab.names[p.concept];
    const second = p.also ? vocab.names[p.also.concept] : undefined;
    if (!forms || (p.also && !second)) return null;
    ({ text: name, plural } = nounForm(forms, p.quantityMax ?? p.quantity, measured));
    if (p.also) {
      name = `${name} ${pack[p.also.joiner]} ${nounForm(second!, p.quantityMax ?? p.quantity, measured).text}`;
      plural = true;
    }
  }
  // Written in its own language the name keeps its words; elsewhere words from the name attach to the noun.
  const attached: string[] = [];
  const notes: string[] = [];
  // "4 spicchi di aglio, tritati": what is chopped is the counted pieces, so notes agree with the unit.
  const counted = !metric && p.unit ? pack.countUnits?.[p.unit] : undefined;
  for (const term of p.terms) {
    if (same && term.inName) continue;
    if (metric && CUP_FILL.has(term.id)) continue;
    const [gender, many] = counted && !term.inName ? [counted, (p.quantityMax ?? p.quantity ?? 1) > 1] : [forms?.gender, plural];
    const text = same ? term.text : vocab.terms[term.id] && termForm(vocab.terms[term.id]!, gender, many);
    if (!text) return null;
    (term.inName ? attached : notes).push(text);
  }
  if (attached.length) name = pack.adjectivesFirst ? `${attached.join(' ')} ${name}` : `${name} ${attached.join(' ')}`;
  const link = linked && pack.unitLink ? `${pack.unitLink} ` : '';
  const rest = `${link}${name}${notes.length ? `, ${notes.join(', ')}` : ''}`;
  return findUnsafeRenderedTerms(`${amount} ${rest}`, language).length ? null : [amount, rest];
}

/** Translate the label after aggregation; the original name still owns the checked-state key. */
export function displayGroceryName(item: GroceryItem, vocab: LanguageVocabulary | undefined, language: string): string {
  return safeTranslation(item.name, item.concept && vocab?.names[item.concept]?.other, language);
}
