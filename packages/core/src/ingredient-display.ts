import { hasDroppedMeasureWords, type ParsedIngredient } from './ingredients';
import { languagePacks } from './languages';
import { findUnsafeRenderedTerms, safeTranslation } from './translations';
import type { GroceryItem } from './grocery';
import { exactMetric, formatMetric, toMetric, type Units } from './metric';
import { formatAmount, formatAmountRange, nounForm, termForm, type LanguageVocabulary, type NounForms } from './vocabulary';

const METRIC_UNITS = new Set(['g', 'kg', 'ml', 'l']);

/**
 * One ingredient line in `language`, as [amount, name and preparation]; commentary is left out.
 * In the recipe's own language the name and preparation keep their written words. In another language
 * every part comes from the vocabulary, or the line is null and the caller keeps the original as written.
 */
export function renderIngredient(
  p: ParsedIngredient, vocab: LanguageVocabulary | undefined, language: string, units: Units, source = 'en'
): [amount: string, rest: string] | null {
  const pack = languagePacks[language];
  if (!vocab || !pack || !p.terms || p.phrase === undefined || !p.name || hasDroppedMeasureWords(p)) return null;
  const same = language === source;
  const number = new Intl.NumberFormat(language, { useGrouping: false, maximumFractionDigits: 10 });
  const label = (unit: string, quantity: number) => vocab.units[unit]?.[quantity <= 1 ? 0 : 1];

  const metric = units === 'metric' ? toMetric(p) : null;
  let amount = '';
  let linked = false;
  if (metric) {
    amount = formatMetric(metric, exactMetric(p, metric)).replace(/\d+(?:\.\d+)?/g, (n) => number.format(Number(n)));
  } else if (p.quantity !== null) {
    amount = formatAmountRange(p.quantity, p.quantityMax, language);
    if (p.unit) {
      const unit = label(p.unit, p.quantityMax ?? p.quantity);
      if (!unit) return null;
      amount += ` ${unit}`;
      linked = !pack.unitLink?.except.includes(p.unit);
    }
    if (p.size) {
      const unit = label(p.size.unit, p.size.quantity);
      if (!unit) return null;
      amount += ` (${formatAmount(p.size.quantity, language)} ${unit})`;
    }
    if (p.metric && p.unit && !METRIC_UNITS.has(p.unit)) amount += ` (${number.format(p.metric.quantity)} ${p.metric.unit})`;
  }

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
  for (const term of p.terms) {
    if (same && term.inName) continue;
    const text = same ? term.text : vocab.terms[term.id] && termForm(vocab.terms[term.id]!, forms?.gender, plural);
    if (!text) return null;
    (term.inName ? attached : notes).push(text);
  }
  if (attached.length) name = pack.adjectivesFirst ? `${attached.join(' ')} ${name}` : `${name} ${attached.join(' ')}`;
  const link = linked && pack.unitLink ? `${pack.unitLink.word} ` : '';
  const rest = `${link}${name}${notes.length ? `, ${notes.join(', ')}` : ''}`;
  return findUnsafeRenderedTerms(`${amount} ${rest}`, language).length ? null : [amount, rest];
}

/** Translate the label after aggregation; the original name still owns the checked-state key. */
export function displayGroceryName(item: GroceryItem, vocab: LanguageVocabulary | undefined, language: string): string {
  return safeTranslation(item.name, item.concept && vocab?.names[item.concept]?.other, language);
}
