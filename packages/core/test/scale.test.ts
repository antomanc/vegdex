import { describe, expect, it } from 'vitest';
import { formatMetric, parseIngredient, parseLine, scaleIngredient, toMetric } from '../src';

const scaled = (line: string, factor: number, units: 'us' | 'metric' = 'us') => {
  const p = scaleIngredient(parseIngredient(line), factor, units);
  return { quantity: p.quantity, quantityMax: p.quantityMax, unit: p.unit, metric: p.metric };
};

describe('scaleIngredient', () => {
  it('lands fractions on what a kitchen measures', () => {
    expect(scaled('1 1/2 cups almond milk', 2)).toMatchObject({ quantity: 3, unit: 'cup' });
    expect(scaled('2/3 cup sugar', 1.5)).toMatchObject({ quantity: 1 });
    expect(scaled('3/4 cup sugar', 0.5).quantity).toBeCloseTo(1 / 3);
    expect(scaled('1/4 tsp salt', 0.25)).toMatchObject({ quantity: 0.125 });
    expect(scaled('1 onion', 1.5)).toMatchObject({ quantity: 1.5, unit: null });
  });

  it('scales both ends of a range', () => {
    expect(scaled('2-3 cloves garlic', 2)).toMatchObject({ quantity: 4, quantityMax: 6, unit: 'clove' });
  });

  it('rounds grams and millilitres written by the blog', () => {
    expect(scaled('125 g flour', 1.5)).toMatchObject({ quantity: 190, unit: 'g' });
    expect(scaled('100 ml water', 0.75)).toMatchObject({ quantity: 75, unit: 'ml' });
  });

  it('keeps the blog grams next to its cups in step', () => {
    expect(scaled('1 cup flour (120 g)', 1.5).metric).toEqual({ quantity: 180, unit: 'g' });
  });

  it('stays exact when converted to metric, so the conversion rounds once', () => {
    const p = scaleIngredient(parseIngredient('1/3 cup flour (40 g)'), 1.25, 'metric');
    expect(formatMetric(toMetric(p)!)).toBe('50 g');
  });

  it('keeps spoons on the kitchen grid in metric, where they are not converted', () => {
    expect(scaled('1 tbsp maple syrup', 1.25, 'metric')).toMatchObject({ quantity: 1.25, unit: 'tbsp' });
    expect(scaled('1 tbsp maple syrup', 1.4, 'metric').quantity).toBeCloseTo(4 / 3);
  });

  it('scales each part of a two-part line', () => {
    const parts = parseLine('1 tbsp cornstarch + 1/2 cup water', { cornstarch: 'cornstarch', water: 'water' });
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => scaleIngredient(p, 2).quantity)).toEqual([2, 1]);
  });

  it('leaves a line without an amount as it is', () => {
    const p = parseIngredient('salt to taste');
    expect(scaleIngredient(p, 3)).toBe(p);
  });

  it('keeps the size of each package', () => {
    const p = scaleIngredient(parseIngredient('1 (15 oz) can chickpeas'), 2);
    expect(p).toMatchObject({ quantity: 2, unit: 'can', size: { quantity: 15, unit: 'oz' } });
  });
});
