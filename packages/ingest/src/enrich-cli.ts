import path from 'node:path';
import { parseArgs } from 'node:util';
import { runLocalEnrich } from './enrich';
import { modelConfig } from './model';
import { RemoteEnrichError, runRemoteEnrich } from './remote-enrich';

async function main() {
  const root = path.resolve(import.meta.dirname, '../../..');
  const { values } = parseArgs({ options: {
    local: { type: 'boolean' }, help: { type: 'boolean' },
    repo: { type: 'string', default: process.env.GITHUB_REPOSITORY ?? 'antomanc/vegdex' },
    queue: { type: 'string', default: path.join(root, '.data/translation-queue.json') },
    learned: { type: 'string', default: path.join(root, '.data/enrichment.json') }
  } });
  if (values.help) {
    console.log('pnpm enrich [--repo owner/repo] [--queue file] [--learned file]\npnpm enrich --local [--queue file] [--learned file]\nFile paths are relative to the repository root. Set ENRICH_BASE_URL and ENRICH_MODEL; ENRICH_API_KEY is optional. Remote mode also needs an authenticated gh CLI with release-write and Actions permissions.');
    return;
  }
  const model = modelConfig();
  const files = { queueFile: path.resolve(root, values.queue!), learnedFile: path.resolve(root, values.learned!), model };
  const report = values.local ? await runLocalEnrich(files) : await runRemoteEnrich({ ...files, repo: values.repo! });
  const json = JSON.stringify(report);
  console.log(model.apiKey ? json.replaceAll(model.apiKey, '[REDACTED]') : json);
  if (report.failed.length) process.exitCode = 1;
  if ('deployment' in report && report.deployment === 'pending') {
    console.error('Enrichment data is saved on GitHub, but deployment is pending. Retry pnpm enrich to trigger deployment.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  // Files, endpoint URLs and provider errors may contain secrets; never echo them.
  console.error(error instanceof RemoteEnrichError ? error.message : 'Enrich failed. Check the local files and ENRICH_BASE_URL / ENRICH_MODEL configuration.');
  process.exitCode = 1;
});
