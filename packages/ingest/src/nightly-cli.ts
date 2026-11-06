import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Source } from '@vegdex/core';
import type { Coverage } from './gaps';
import { loadLineRecords } from './line-records';
import { publishedLines } from './lines-fill';
import { updateBacklog, runGh, type HeldRecipe } from './nightly';
import { loadStore } from './store';
import { loadVocabulary } from './vocab';

const root = path.resolve(import.meta.dirname, '../../..');
const { values } = parseArgs({ options: {
  repo: { type: 'string', default: process.env.GITHUB_REPOSITORY ?? 'antomanc/vegdex' },
  coverage: { type: 'string', default: path.join(root, 'apps/web/public/data/coverage.json') },
  held: { type: 'string', default: path.join(root, '.data/held.json') },
  store: { type: 'string', default: path.join(root, '.data/store.json.gz') }
} });
const coverage = JSON.parse(fs.readFileSync(values.coverage!, 'utf8')) as Coverage;
const held = JSON.parse(fs.readFileSync(values.held!, 'utf8')) as HeldRecipe[];
// Distinct catalog lines still on the parser path: every published recipe line with no saved record.
const sources = JSON.parse(fs.readFileSync(new URL('../sources.json', import.meta.url), 'utf8')) as Source[];
const records = loadLineRecords();
const published = publishedLines(Object.values(loadStore(values.store!).recipes), sources, loadVocabulary());
const linesWithoutRecord = [...published].filter(([key]) => !records.has(key)).length;
console.log(`Updated issue #${updateBacklog(coverage, held, values.repo!, runGh, linesWithoutRecord)}`);
