import fs from 'node:fs';
import path from 'node:path';
import { emitDataset, seedTranslations } from '../packages/ingest/src/emit';
import { loadStore } from '../packages/ingest/src/store';
import { extractRecipe } from '../packages/ingest/src/extract';

const root = path.join(import.meta.dirname, 'fixtures');
const store = loadStore(path.join(root, 'store.json'));
const sources = JSON.parse(fs.readFileSync(new URL('../packages/ingest/sources.json', import.meta.url), 'utf8'));
const italian = JSON.parse(fs.readFileSync(path.join(root, 'italian.json'), 'utf8'));
const sample = JSON.parse(fs.readFileSync(new URL('../packages/ingest/test/fixtures/cucinaverza-gnocchi.json', import.meta.url), 'utf8'));
const realRecipe = extractRecipe(`<script type="application/ld+json">${JSON.stringify(sample.recipe)}</script>`, sample.sourceUrl, 'cucinaverza');
if (!realRecipe) throw new Error('Cucinaverza fixture did not extract');
const options = { generatedAt: '2026-10-29T00:00:00.000Z', blocklist: JSON.parse(fs.readFileSync(path.join(root, 'blocklist.json'), 'utf8')) };
for (const mixed of [false, true]) {
  const out = path.join(root, mixed ? 'italian-data' : 'data');
  fs.mkdirSync(out, { recursive: true });
  const report = emitDataset(
    [...Object.values(store.recipes), ...mixed ? [...italian.recipes, realRecipe] : []],
    [...sources, ...mixed ? [italian.source] : []],
    out,
    { ...options, learnedData: mixed ? italian.learned : undefined, translations: { ...seedTranslations, en: { ...seedTranslations.en, ...mixed ? italian.titles : {} } } }
  );
  if (!mixed) fs.writeFileSync(path.join(root, 'excluded.json'), JSON.stringify(report.excluded, null, 1));
  console.log(`${mixed ? 'Mixed-language' : 'English'} fixtures: ${report.published} recipes`);
}
