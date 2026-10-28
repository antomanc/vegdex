import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseIngredient, type FullDataset } from '@vegdex/core';
import { englishLookup } from '../src/concepts';

const file = process.argv[2];
if (!file) throw new Error('Usage: catalog-coverage.ts recipes.full.json [output.json]');
const input = fs.readFileSync(file);
const data = JSON.parse(input.toString('utf8')) as FullDataset;
const unmapped: Record<string, number> = Object.create(null);
let mapped = 0;
let lines = 0;
for (const r of data.recipes) for (const line of r.ingredients) {
  lines++;
  const p = parseIngredient(line, englishLookup);
  if (p.concept) mapped++;
  else unmapped[p.name || p.raw] = (unmapped[p.name || p.raw] ?? 0) + 1;
}
const report = { generatedAt: data.generatedAt, sha256: createHash('sha256').update(input).digest('hex'), recipes: data.recipes.length, lines, mapped,
  unmapped: Object.fromEntries(Object.entries(unmapped).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ ...report, unmapped: Object.keys(unmapped).length, percent: 100 * mapped / lines }));
