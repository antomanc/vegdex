import { canonicalName, hasDroppedMeasureWords, parseIngredient, unitDef, type ParsedIngredient } from './ingredients';
import { gramsPerCup } from './weights';

export type Units = 'us' | 'metric';

export interface MetricAmount {
  quantity: number;
  quantityMax: number | null;
  unit: 'g' | 'ml' | 'cm';
  /** Weighed through the density table rather than converted exactly. */
  estimate: boolean;
}

/** Spoons stay spoons: metric kitchens use them too, and scales are unreliable below a few grams. */
const KEPT = new Set(['tsp', 'tbsp']);

/**
 * The metric amount for a parsed line, or null when it stays as written:
 * spoons, whole items, unmeasured lines and lines already in metric.
 */
export function toMetric(p: ParsedIngredient): MetricAmount | null {
  if (p.quantity === null || !p.unit || KEPT.has(p.unit)) return null;
  const def = unitDef(p.unit);
  if (!def) return null;
  const range = (factor: number) => ({ quantity: p.quantity! * factor, quantityMax: p.quantityMax === null ? null : p.quantityMax * factor });
  if (def.unit === 'inch') return { ...range(2.54), unit: 'cm', estimate: false };
  if (['g', 'kg', 'ml', 'l'].includes(def.unit) || (def.dimension !== 'mass' && def.dimension !== 'volume')) return null;
  // The blog's own grams beat any conversion; its ml are only a starting point for the density.
  if (p.metric?.unit === 'g') return { ...range(p.metric.quantity / p.quantity), unit: 'g', estimate: false };
  if (def.dimension === 'mass') return { ...range(def.factor), unit: 'g', estimate: false };

  // A blog's ml can be checked against its cups: "¼ cup pumpkin puree (5 ml)" is a typo, not a measure.
  const blogMl = p.metric?.unit === 'ml' ? p.metric.quantity / p.quantity : null;
  const ml = blogMl && Math.abs(blogMl / def.factor - 1) <= 0.5 ? blogMl : def.factor;
  // "brown or green lentils" is named "brown": the last alternative names the food.
  const perCup = gramsPerCup(p.densityName ?? p.name) ?? gramsPerCup(canonicalName(p.afterMeasure?.split(/\s(?:or|and)\s/).at(-1) ?? ''));
  if (perCup) return { ...range((ml / 240) * perCup), unit: 'g', estimate: true };
  return { ...range(ml), unit: 'ml', estimate: false };
}

/** Kitchen precision: no "236.6 ml". Under 10 to the unit, then to 5 (so a cup of flour stays 125 g), 10 and 25. */
export function roundKitchen(n: number): number {
  if (n < 10) return Math.max(1, Math.round(n));
  if (n < 250) return Math.round(n / 5) * 5;
  if (n < 500) return Math.round(n / 10) * 10;
  return Math.round(n / 25) * 25;
}

function formatNumber(n: number, unit: MetricAmount['unit'], exact: boolean): string {
  if (unit === 'cm') return String(Math.round(n * 2) / 2);
  if (n >= 1000) return String(Math.round(n / 100) / 10);
  return String(exact ? Math.round(n) : roundKitchen(n));
}

/**
 * "≈ 125 g", "60–75 g", "1.3 kg", "2.5 cm".
 * `exact` keeps the number as given (a blog's own grams), otherwise it is rounded for the kitchen.
 */
export function formatMetric(m: MetricAmount, exact = false): string {
  const big = Math.max(m.quantity, m.quantityMax ?? 0) >= 1000 && m.unit !== 'cm';
  const unit = big ? (m.unit === 'g' ? 'kg' : 'l') : m.unit;
  const low = formatNumber(m.quantity, m.unit, exact);
  const high = m.quantityMax !== null ? formatNumber(m.quantityMax, m.unit, exact) : null;
  const amount = high && high !== low ? `${big && m.quantity < 1000 ? Math.round(m.quantity / 100) / 10 : low}–${high}` : low;
  return `${m.estimate ? '≈ ' : ''}${amount} ${unit}`;
}

/**
 * A published line in metric, split into its amount and the rest:
 * "1 cup flour, sifted" → ["≈ 125 g", "flour, sifted"]. Null when the line stays as written.
 */
export function metricLine(raw: string, p = parseIngredient(raw)): [amount: string, rest: string] | null {
  if (hasDroppedMeasureWords(p)) return null;
  const m = toMetric(p);
  if (!m || p.afterMeasure === null) return null;
  const blogGrams = p.metric?.unit === 'g' && m.unit === 'g' && !m.estimate;
  return [formatMetric(m, blogGrams), p.afterMeasure.replace(/^of\s+/i, '').trim()];
}
