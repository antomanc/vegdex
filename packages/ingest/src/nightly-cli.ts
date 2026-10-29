import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Coverage } from './gaps';
import { updateBacklog, type HeldRecipe } from './nightly';

const root = path.resolve(import.meta.dirname, '../../..');
const { values } = parseArgs({ options: {
  repo: { type: 'string', default: process.env.GITHUB_REPOSITORY ?? 'antomanc/vegdex' },
  coverage: { type: 'string', default: path.join(root, 'apps/web/public/data/coverage.json') },
  held: { type: 'string', default: path.join(root, '.data/held.json') }
} });
const coverage = JSON.parse(fs.readFileSync(values.coverage!, 'utf8')) as Coverage;
const held = JSON.parse(fs.readFileSync(values.held!, 'utf8')) as HeldRecipe[];
console.log(`Updated issue #${updateBacklog(coverage, held, values.repo!)}`);
