import { unitDef } from './ingredients';

type UnitLabels = Record<string, readonly [string, string]>;
const quantity = /\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞]/gu;

function knownUnit(phrase: string, labels: UnitLabels): string | undefined {
  return (unitDef(phrase) ?? unitDef(phrase.toLowerCase()))?.unit
    ?? Object.entries(labels).find(([, forms]) => forms.some((form) => form.toLowerCase() === phrase.toLowerCase()))?.[0];
}

/** Quantities keep their own units; unknown adjacent words must stay literal until equivalence is curated. */
export function measurements(text: string, labels: UnitLabels = {}): [value: string, unit: string][] {
  const result: [string, string][] = [];
  const covered = new Set<number>();
  for (const match of text.matchAll(quantity)) {
    const start = match.index + match[0].length;
    const suffix = /^[\s\-–°]*(["\p{L}]+(?:\s+[\p{L}]+){0,2})/u.exec(text.slice(start));
    const words = suffix?.[1]?.split(/\s+/) ?? [];
    let unit = words[0] ? `?${words[0].toLowerCase()}` : '';
    for (let count = words.length; count > 0; count--) {
      const found = knownUnit(words.slice(0, count).join(' '), labels);
      if (!found) continue;
      unit = found;
      const offset = start + suffix![0].indexOf(suffix![1]!);
      let remaining = count;
      for (const word of suffix![1]!.matchAll(/["\p{L}]+/gu)) {
        if (remaining-- <= 0) break;
        covered.add(offset + word.index);
      }
      break;
    }
    result.push([match[0].replace(',', '.'), unit]);
  }
  // A bare introduced "kg" must not evade the check merely because no number preceded it.
  for (const word of text.matchAll(/\p{L}+/gu)) {
    if (covered.has(word.index) || /^(?:in|can|l)$/i.test(word[0])) continue;
    const unit = knownUnit(word[0], labels);
    if (unit) result.push(['', unit]);
  }
  return result;
}

export function sameMeasurements(original: string, translated: string, labels: UnitLabels): boolean {
  const signature = (value: string) => measurements(value, labels).map((m) => JSON.stringify(m)).sort().join('|');
  return signature(original) === signature(translated);
}
