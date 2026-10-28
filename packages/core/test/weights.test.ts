import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cupWeight, gramsPerCup, parseIngredient, unitDef } from '../src';

// Cup-measured lines from the published catalog, refreshed with `pnpm ingest weights`.
const snapshot = JSON.parse(readFileSync(new URL('./fixtures/volume-lines.json', import.meta.url), 'utf8')) as {
  names: [string, number][];
  withGrams: string[];
};

describe('gramsPerCup', () => {
  it('knows most volume-measured lines in the catalog', () => {
    const total = snapshot.names.reduce((n, [, c]) => n + c, 0);
    const known = snapshot.names.reduce((n, [name, c]) => n + (gramsPerCup(name) ? c : 0), 0);
    expect(known / total).toBeGreaterThanOrEqual(0.98);
  });

  it('agrees with the grams blogs wrote next to their cups', () => {
    // Per table entry, the median of what blogs wrote: single lines carry typos and odd conversions.
    const ratios = new Map<string, number[]>();
    for (const line of snapshot.withGrams) {
      const p = parseIngredient(line);
      const weight = cupWeight(p.name);
      const def = p.unit ? unitDef(p.unit) : undefined;
      if (!weight || !def || p.quantity === null || !p.metric || p.metric.unit !== 'g') continue;
      const estimate = ((p.quantityMax ?? p.quantity) * def.factor * weight.grams) / 240;
      ratios.set(weight.pattern, [...(ratios.get(weight.pattern) ?? []), estimate / p.metric.quantity]);
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const all = [...ratios.values()].flat().map((r) => Math.abs(r - 1));
    expect(all.length).toBeGreaterThan(1000);
    expect(median(all)).toBeLessThanOrEqual(0.1);
    const off = [...ratios]
      .filter(([, rs]) => rs.length >= 5)
      .map(([pattern, rs]) => [pattern, Math.round(median(rs) * 100) / 100] as const)
      .filter(([, r]) => Math.abs(r - 1) > 0.25);
    expect(off).toEqual([]);
  });

  it('matches the specific name before the family that also fits', () => {
    expect(gramsPerCup('coconut milk')).toBe(226);
    expect(gramsPerCup('almond milk')).toBe(243);
    expect(gramsPerCup('chickpea flour')).toBe(92);
    expect(gramsPerCup('peanut butter')).toBe(256);
    expect(gramsPerCup('vegan butter')).toBe(227);
    expect(gramsPerCup('butternut squash')).toBe(140);
    expect(gramsPerCup('brown sugar')).toBe(220);
    expect(gramsPerCup('nutritional yeast')).toBe(60);
  });

  it('gives up on names it cannot place', () => {
    expect(gramsPerCup('')).toBeNull();
    expect(gramsPerCup('fregola sarda')).toBeNull();
  });
});
