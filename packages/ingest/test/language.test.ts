import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Recipe } from '@vegdex/core';
import { describe, expect, it } from 'vitest';
import { emitDataset } from '../src/emit';
import { isCandidateUrl } from '../src/sitemap';

describe('Translated source editions', () => {
  it('never crawls a translated edition of a blog', () => {
    expect(isCandidateUrl('https://elavegan.com/de/haferflocken-wraps/', 'https://elavegan.com')).toBe(false);
    expect(isCandidateUrl('https://example.com/fr-ca/tarte/', 'https://example.com')).toBe(false);
    expect(isCandidateUrl('https://elavegan.com/oatmeal-wraps/', 'https://elavegan.com')).toBe(true);
    expect(isCandidateUrl('https://example.com/de-stress-smoothie/', 'https://example.com')).toBe(true);
  });

  it('leaves translated recipes already in the store out of the dataset', () => {
    const recipe = (id: string, url: string): Recipe => ({
      id, url, title: id, sourceId: 'elavegan', image: null, minutes: 10, servings: 2, rating: null, ratingCount: null,
      calories: null, protein: null, published: null, categories: [], cuisines: [], keywords: [], ingredients: ['1 cup oats']
    });
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-emit-'));
    const report = emitDataset(
      [recipe('en', 'https://elavegan.com/oat-wraps/'), recipe('de', 'https://elavegan.com/de/haferflocken-wraps/')],
      [{ id: 'elavegan', name: 'ElaVegan', url: 'https://elavegan.com' }],
      out
    );
    expect(report.published).toBe(1);
    expect(report.otherLanguage).toBe(1);
    fs.rmSync(out, { recursive: true });
  });
});
