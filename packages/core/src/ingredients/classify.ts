import { cleanText } from '../text';
import type { ParsedIngredient } from './types';
import type { AmountResult } from './amount';
import type { NameResult } from './name';
import type { Resolution } from './resolve';

/** Headings, equipment, instructions and asides written among the ingredients. */
function lineKind(raw: string, quantity: number | null, concept: string | null, name: string): ParsedIngredient['kind'] {
  if (quantity !== null || concept) return undefined;
  if (/:\s*$/.test(raw) || /^(?:for|per)\s+(?:the\s+|il\s+|la\s+|lo\s+|l['’]|i\s+|le\s+|gli\s+)?[^,;()]{1,40}$/i.test(raw)) return 'heading';
  if (!name) return 'other';
  if (/^(?:i|i'm|i've|you|we|use|add|serve|see|note|notes|tip|equipment|this|if|make|to make|recipe|check|it is|it's|do not|don't)\b/i.test(raw)) return 'other';
  if (/\b(?:mixing bowls?|baking (?:sheet|dish|pan)s?|skillet|blender|food processor|kitchen scale|scale for accuracy|thermometer|parchment paper|piping bag|muffin tin|loaf pan|cake pan|stand mixer|hand mixer)\b/i.test(raw)) return 'other';
  return undefined;
}

/** Decide whether the line is an ingredient or not, and build the final parsed shape. */
export function classify(raw: string, optional: boolean, measure: Pick<AmountResult, 'quantity' | 'quantityMax' | 'unit' | 'metric' | 'afterMeasure' | 'approx'>, named: Pick<NameResult, 'name' | 'note'>, resolved: Resolution): ParsedIngredient {
  const kind = lineKind(cleanText(raw), measure.quantity, resolved.concept, named.name);
  return {
    conceptExact: resolved.conceptExact,
    phrase: resolved.phrase,
    terms: resolved.terms,
    size: resolved.size,
    also: resolved.also,
    ...(measure.approx ? { approx: true as const } : {}),
    ...(kind ? { kind } : {}),
    raw: cleanText(raw),
    quantity: measure.quantity,
    quantityMax: measure.quantityMax,
    unit: measure.unit,
    metric: measure.metric,
    afterMeasure: measure.afterMeasure,
    name: kind ? '' : named.name,
    concept: kind ? null : resolved.concept,
    note: named.note,
    optional: optional
  };
}
