import { sameMeasurements } from './measurements';
import { hasDroppedMeasureWords, type ParsedIngredient } from './ingredients';
import { findUnsafeRenderedTerms, safeTranslation } from './translations';
import type { GroceryItem } from './grocery';
import { formatMetric, toMetric, type Units } from './metric';

export interface IngredientTables {
  names: Record<string, string>;
  notes: Record<string, string>;
  units: Record<string, [singular: string, plural: string]>;
}

/** Preparation text that still needs translating, excluding an equivalent already used in the amount. */
export function ingredientNote(p: ParsedIngredient): string {
  let note = p.note;
  const equivalent = note.match(/^(?:\(\s*)?(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\)?(?:$|[,;]\s*)/i);
  if (p.metric && equivalent && Number(equivalent[1]!.replace(',', '.')) === p.metric.quantity && equivalent[2]!.toLowerCase() === p.metric.unit) note = note.slice(equivalent[0].length).trim();
  if (!note && /\bto taste\b/i.test(p.raw)) note = 'to taste';
  return note;
}

/** Null means the caller keeps the complete original line. */
export function renderIngredient(p: ParsedIngredient, tables: IngredientTables | undefined, language: string, units: Units): [amount: string, rest: string] | null {
  if (!p.concept || p.conceptExact !== true || !tables || hasDroppedMeasureWords(p)) return null;
  const name = tables.names[p.concept];
  const originalNote = ingredientNote(p);
  const note = originalNote ? tables.notes[originalNote] ?? '' : '';
  if (!name || (originalNote && !note) || !sameMeasurements(originalNote, note, tables.units)) return null;
  const number = new Intl.NumberFormat(language, { useGrouping: false, maximumFractionDigits: 10 });
  const metric = units === 'metric' ? toMetric(p) : null;
  let amount = p.quantity === null ? '' : number.format(p.quantity);
  if (p.quantityMax !== null) amount += `–${number.format(p.quantityMax)}`;
  if (metric) {
    amount = formatMetric(metric, p.metric?.unit === 'g' && !metric.estimate).replace(/\d+(?:\.\d+)?/g, (n) => number.format(Number(n)));
  } else if (p.unit) {
    const labels = tables.units[p.unit];
    if (!labels) return null;
    amount += ` ${labels[(p.quantityMax ?? p.quantity) === 1 ? 0 : 1]}`;
  }
  if (!metric && p.metric && p.unit && !['g', 'kg', 'ml', 'l'].includes(p.unit)) amount += ` (${number.format(p.metric.quantity)} ${p.metric.unit})`;
  const rest = `${name}${note ? `, ${note}` : ''}`;
  return findUnsafeRenderedTerms(`${amount} ${rest}`, language).length ? null : [amount, rest];
}

/** Translate the label after aggregation; the original name still owns the checked-state key. */
export function displayGroceryName(item: GroceryItem, tables: IngredientTables | undefined, language: string): string {
  return safeTranslation(item.name, item.concept && tables?.names[item.concept], language);
}
