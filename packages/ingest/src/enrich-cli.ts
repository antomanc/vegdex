import path from 'node:path';
import { parseArgs } from 'node:util';
import { runLocalEnrich } from './enrich';
import { modelConfig } from './model';

async function main() {
  const root = path.resolve(import.meta.dirname, '../../..');
  const { values } = parseArgs({ options: {
    local: { type: 'boolean' }, help: { type: 'boolean' },
    queue: { type: 'string', default: path.join(root, '.data/translation-queue.json') },
    learned: { type: 'string', default: path.join(root, '.data/enrichment.json') }
  } });
  if (values.help) {
    console.log('pnpm enrich --local [--queue file] [--learned file]\nSet ENRICH_BASE_URL and ENRICH_MODEL; ENRICH_API_KEY is optional.');
    return;
  }
  const model = modelConfig();
  const report = await runLocalEnrich({ queueFile: values.queue!, learnedFile: values.learned!, model });
  const json = JSON.stringify(report);
  console.log(model.apiKey ? json.replaceAll(model.apiKey, '[REDACTED]') : json);
  if (report.failed.length) process.exitCode = 1;
}

main().catch(() => {
  // Files, endpoint URLs and provider errors may contain secrets; never echo them.
  console.error('Enrich failed. Check the local files and ENRICH_BASE_URL / ENRICH_MODEL configuration.');
  process.exitCode = 1;
});
