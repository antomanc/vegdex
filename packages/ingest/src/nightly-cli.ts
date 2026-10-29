import path from 'node:path';
import { parseArgs } from 'node:util';
import { readTranslationQueue, writeJSONAtomic } from './enrichment';
import { restoreEnrichment, saveTranslationQueue, updateBacklog } from './nightly';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  repo: { type: 'string', default: process.env.GITHUB_REPOSITORY ?? 'antomanc/vegdex' },
  dir: { type: 'string', default: path.resolve(import.meta.dirname, '../../../.data') }
} });
const dir = values.dir!;
if (positionals[0] === 'restore') restoreEnrichment(values.repo!, dir);
else if (positionals[0] === 'save') saveTranslationQueue(values.repo!, dir);
else if (positionals[0] === 'backlog') {
  const file = path.join(dir, 'translation-queue.json');
  writeJSONAtomic(file, updateBacklog(readTranslationQueue(file), values.repo!));
} else throw new Error('Use nightly:enrichment restore | backlog | save');
