import { describe, it, expect } from 'vitest';
import { lineKey, validateRecord } from '../src/line-records';

const record = (line = '½ cup fresh ginger') => ({ line, language: 'en', parts: [{ quantity: .5, unit: 'cup', en: 'fresh ginger', it: 'zenzero fresco' }] });
describe('line records', () => {
  it('normalizes only Unicode and whitespace', () => {
    expect(lineKey('en', '  cafe\u0301  ½ cup ')).toBe(lineKey('en', 'café ½ cup'));
    expect(lineKey('it', 'salt')).not.toBe(lineKey('en', 'salt'));
    expect(lineKey('en', '1 salt')).not.toBe(lineKey('en', '2 salt'));
    expect(lineKey('en', 'salt,')).not.toBe(lineKey('en', 'salt'));
  });
  it('compares numeric fractions and mixed numbers', () => {
    for (const line of ['½ cup fresh ginger', '1/2 cup fresh ginger', '0.5 cup fresh ginger']) expect(validateRecord(record(line))).toEqual([]);
    expect(validateRecord({ ...record('1 1/2 cups ginger'), parts: [{ quantity: 1.5, en: 'ginger', it: 'zenzero' }] })).toEqual([]);
    expect(validateRecord(record('2 cups fresh ginger'))).toContainEqual({ code: 'number-not-in-line', severity: 'review' });
  });
  it('rejects malformed data, ranges, units and duplicate names', () => {
    expect(validateRecord(null)[0]?.severity).toBe('error');
    for (const fields of [{ quantity: Infinity }, { quantity: -1 }, { quantityMax: .4 }, { unit: 'unknown' }, { en: '' }]) {
      const r = record(); Object.assign(r.parts[0]!, fields);
      expect(validateRecord(r).some(f => f.severity === 'error')).toBe(true);
    }
    const r = record(); r.parts.push(r.parts[0]!);
    expect(validateRecord(r).map(f=>f.code)).toContain('duplicate-part');
    expect(validateRecord({ ...record(), kind: 'heading' }).map(f=>f.code)).toContain('kind');
  });
  it('flags lost qualifiers, unsafe names and English in Italian', () => {
    const r = { line: '1 tbsp vegan butter, fresh', language: 'en', parts: [{ quantity: 1, en: 'butter', it: 'butter' }] };
    expect(validateRecord(r).map(f=>f.code)).toEqual(expect.arrayContaining(['qualifier-lost','unsafe-name','english-in-italian']));
  });
});
