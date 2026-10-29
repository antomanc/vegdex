import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  emptyLearnedData, emptyQueue, readLearnedData, readTranslationQueue,
  validateLearnedData, validateTranslationQueue, writeJSONAtomic, type TranslationQueue
} from './enrichment';

/** Process boundary: tests replace gh, never the ingest or enrichment logic. */
export type GhRunner = (args: string[], input?: string) => string;
export const runGh: GhRunner = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });

function releaseAssets(repo: string, gh: GhRunner): Set<string> | null {
  let response: string;
  try {
    response = gh(['api', `repos/${repo}/releases/tags/data`]);
  } catch (error) {
    if (error instanceof Error && 'stderr' in error && /HTTP 404\b/.test(String(error.stderr))) return null;
    throw error;
  }
  const release: unknown = JSON.parse(response);
  if (!release || typeof release !== 'object' || !('assets' in release) || !Array.isArray(release.assets) ||
    !release.assets.every((asset) => asset && typeof asset === 'object' && typeof asset.name === 'string'))
    throw new Error('Invalid release asset listing');
  return new Set(release.assets.map((asset) => String(asset.name)));
}

/** Absence is migration; listing/download/validation failures leave all local files intact. */
export function restoreEnrichment(repo: string, dir: string, gh = runGh): void {
  const assets = releaseAssets(repo, gh) ?? new Set<string>();
  fs.mkdirSync(dir, { recursive: true });
  const stage = fs.mkdtempSync(path.join(dir, '.enrichment-restore-'));
  const files = ['enrichment.json', 'translation-queue.json'];
  try {
    for (const file of files) if (assets.has(file)) {
      gh(['release', 'download', 'data', '--repo', repo, '--pattern', file, '--dir', stage]);
      const value: unknown = JSON.parse(fs.readFileSync(path.join(stage, file), 'utf8'));
      if (file === 'enrichment.json') validateLearnedData(value);
      else validateTranslationQueue(value);
    }
    // Validate preserved local files too, before making any replacement.
    for (const file of files) if (!assets.has(file) && fs.existsSync(path.join(dir, file))) {
      if (file === 'enrichment.json') readLearnedData(path.join(dir, file));
      else readTranslationQueue(path.join(dir, file));
    }
    for (const file of files) {
      const target = path.join(dir, file);
      if (assets.has(file)) fs.renameSync(path.join(stage, file), target);
      else if (!fs.existsSync(target)) writeJSONAtomic(target, file === 'enrichment.json' ? emptyLearnedData() : emptyQueue());
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

/** Nightly never uploads restored learned data: a desktop run may have updated it meanwhile. */
export function saveTranslationQueue(repo: string, dir: string, gh = runGh): void {
  const file = path.join(dir, 'translation-queue.json');
  validateTranslationQueue(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (releaseAssets(repo, gh) === null)
    gh(['release', 'create', 'data', '--repo', repo, '--title', 'Crawl state', '--notes', 'Crawl and enrichment state; not a software release.']);
  gh(['release', 'upload', 'data', file, '--clobber', '--repo', repo]);
}

/** Routine edits contain no mention; only newly overdue held recipes get a notification. */
export function updateBacklog(queue: TranslationQueue, repo: string, gh = runGh): TranslationQueue {
  validateTranslationQueue(queue);
  const counts = { title: 0, ingredient: 0, note: 0 };
  for (const task of queue.tasks) counts[task.kind]++;
  const now = Date.parse(queue.generatedAt);
  const age = queue.tasks.length ? Math.max(0, Math.floor((now - Math.min(...queue.tasks.map((task) => Date.parse(task.firstSeen)))) / 86_400_000)) : 0;
  const body = `Translation backlog\n\n${counts.title} titles, ${counts.ingredient} ingredients and ${counts.note} note phrases await enrichment.\n\nOldest queued string: ${age} days. Held recipes: ${queue.held.length}.\n\nRun the manual enrich command to catch up. English recipes continue to publish in their original language.\n`;
  let number = queue.issueNumber;
  if (number && gh(['issue', 'view', String(number), '--repo', repo, '--json', 'title', '--jq', '.title']).trim() !== 'Translation backlog')
    throw new Error('Persisted issue number is not the Translation backlog issue');
  if (!number) {
    const issues = JSON.parse(gh(['issue', 'list', '--repo', repo, '--state', 'all', '--search', 'in:title "Translation backlog"', '--json', 'number,title', '--limit', '100'])) as { number: number; title: string }[];
    number = issues.find((issue) => issue.title === 'Translation backlog')?.number;
  }
  if (number) gh(['issue', 'edit', String(number), '--repo', repo, '--body-file', '-'], body);
  else {
    const url = gh(['issue', 'create', '--repo', repo, '--title', 'Translation backlog', '--body-file', '-'], body).trim();
    number = Number(url.split('/').at(-1));
    if (!Number.isInteger(number) || number <= 0) throw new Error('Could not identify the Translation backlog issue');
  }
  const overdue = queue.held.filter((held) => !held.notifiedAt && now - Date.parse(held.since) > 7 * 86_400_000);
  const marker = (id: string, since: string) => `<!-- held:${createHash('sha256').update(`${id}\0${since}`).digest('hex')} -->`;
  if (overdue.length) {
    // A comment is the durable receipt if uploading the queue failed after a previous notification.
    const comments = gh(['api', `repos/${repo}/issues/${number}/comments`, '--paginate', '--jq', '.[].body']);
    const fresh = overdue.filter((held) => !comments.includes(marker(held.id, held.since)));
    if (fresh.length) gh(['issue', 'comment', String(number), '--repo', repo, '--body-file', '-'],
      `@${repo.split('/')[0]} These recipes have been held for more than seven days:\n\n${fresh.map((held) => `- ${held.id} (since ${held.since}) ${marker(held.id, held.since)}`).join('\n')}\n`);
  }
  const notified = new Set(overdue.map((held) => held.id));
  return { ...queue, issueNumber: number, held: queue.held.map((held) => notified.has(held.id) ? { ...held, notifiedAt: queue.generatedAt } : held) };
}
