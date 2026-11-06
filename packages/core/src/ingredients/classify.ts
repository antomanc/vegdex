import { cleanText } from '../text';
import type { ParseState, ParsedIngredient } from './types';

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
export function classify(state: ParseState, raw: string): ParsedIngredient {
  const kind = lineKind(cleanText(raw), state.quantity, state.concept, state.name);
  return {
    conceptExact: state.conceptExact,
    phrase: state.phrase,
    terms: state.terms,
    size: state.size,
    also: state.also,
    ...(state.approx ? { approx: true as const } : {}),
    ...(kind ? { kind } : {}),
    raw: cleanText(raw),
    quantity: state.quantity,
    quantityMax: state.quantityMax,
    unit: state.unit,
    metric: state.metric,
    afterMeasure: state.afterMeasure,
    name: kind ? '' : state.name,
    concept: kind ? null : state.concept,
    note: state.note,
    optional: state.optional
  };
}
