import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Process boundary: tests replace gh, never the release logic. */
export type GhRunner = (args: string[], stdio?: 'inherit' | 'ignore') => void;
export const runGh: GhRunner = (args, stdio = 'inherit') => execFileSync('gh', args, { stdio });

/** The asset name daily.yml restores; a store under any other name is a different file to the workflow. */
export const STORE_ASSET = 'store.json.gz';

/** Fetch the crawl state the daily workflow last saved, into the path this run reads. */
export function pullStore(store: string, gh: GhRunner = runGh): void {
  fs.mkdirSync(path.dirname(store), { recursive: true });
  gh(['release', 'download', 'data', '--pattern', STORE_ASSET, '--output', store, '--clobber']);
}

/** Upload a locally emitted store and deploy from it, without crawling again. */
export function publishStore(store: string, gh: GhRunner = runGh): void {
  if (path.basename(store) !== STORE_ASSET)
    throw new Error(`--publish needs --store to end in ${STORE_ASSET} (the asset daily.yml restores), not ${path.basename(store)}`);
  const dir = path.dirname(store);
  try {
    gh(['release', 'view', 'data'], 'ignore');
  } catch {
    gh(['release', 'create', 'data', '--title', 'Crawl state',
      '--notes', 'Ingest store used by the daily workflow. Not a software release.']);
  }
  const report = path.join(dir, 'crawl-report.json');
  const assets = [store, path.join(dir, 'excluded.json'), ...(fs.existsSync(report) ? [report] : [])];
  gh(['release', 'upload', 'data', '--clobber', ...assets]);
  gh(['workflow', 'run', 'daily.yml', '-f', 'crawl=false']);
}
