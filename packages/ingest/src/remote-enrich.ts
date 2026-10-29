import fs from 'node:fs';
import path from 'node:path';
import { ingredientKey, safeTranslation } from '@vegdex/core';
import { isTaskComplete, runLocalEnrich, type EnrichReport } from './enrich';
import { seedIngredientTables, seedTranslations } from './emit';
import { seed } from './concepts';
import {
  mergeEnrichment, readLearnedData, readTranslationQueue, validateLearnedData, validateTranslationQueue, writeJSONAtomic,
  type LearnedData, type QueueTask, type TranslationQueue
} from './enrichment';
import type { ModelConfig } from './model';
import { restoreEnrichment, runGh, type GhRunner } from './nightly';

const failureMessages = {
  download: 'Could not download enrichment. Previously accepted local work is unchanged; retry when GitHub is available.',
  local: 'Could not read or save enrichment files. Check the local files before retrying.',
  upload: 'Could not upload enrichment. Accepted work remains saved locally; retry pnpm enrich.'
};

/** Only fixed messages may reach the CLI; provider errors can contain credentials. */
export class RemoteEnrichError extends Error {
  constructor(phase: keyof typeof failureMessages) { super(failureMessages[phase]); }
}

function mergeRecords(local: Record<string, Record<string, string>>, remote: Record<string, Record<string, string>>) {
  return Object.fromEntries([...new Set([...Object.keys(local), ...Object.keys(remote)])].map((language) =>
    [language, { ...local[language], ...remote[language] }]));
}

/** Reuse emit's semantic guards before an older remote cache can replace a safe local result. */
function acceptedCache(data: LearnedData): LearnedData {
  const merged = mergeEnrichment(data, seedTranslations, seedIngredientTables);
  const seedIds = new Set(seed.concepts.map((concept) => concept.id));
  return {
    version: 1,
    concepts: merged.concepts.filter((concept) => !seedIds.has(concept.id)),
    titles: Object.fromEntries(Object.entries(data.titles).map(([language, entries]) => [language,
      Object.fromEntries(Object.entries(entries).filter(([original, value]) =>
        merged.titles[language]?.[original] === value && safeTranslation('', value, language) === value))])),
    aliases: Object.fromEntries(Object.entries(data.aliases).map(([language, entries]) => [language,
      Object.fromEntries(Object.entries(entries).filter(([alias, id]) => merged.aliases[language]?.[ingredientKey(alias)] === id))])),
    ingredientTables: Object.fromEntries(Object.entries(data.ingredientTables).map(([language, tables]) => [language, {
      names: Object.fromEntries(Object.entries(tables.names).filter(([id, value]) => merged.ingredientTables[language]?.names[id] === value)),
      notes: Object.fromEntries(Object.entries(tables.notes).filter(([note, value]) => merged.ingredientTables[language]?.notes[note] === value)),
      units: {}
    }]))
  };
}

/** Published values win conflicts; local additions survive a failed publication and retry. */
function mergeLearned(localData: LearnedData, remoteData: LearnedData): LearnedData {
  const local = acceptedCache(localData);
  const remote = acceptedCache(remoteData);
  const concepts = new Map(local.concepts.map((concept) => [concept.id, concept]));
  for (const concept of remote.concepts) {
    const previous = concepts.get(concept.id);
    concepts.set(concept.id, { ...concept, names: { ...previous?.names, ...concept.names } });
  }
  const languages = new Set([...Object.keys(local.ingredientTables), ...Object.keys(remote.ingredientTables)]);
  return validateLearnedData({
    version: 1, concepts: [...concepts.values()].sort((a, b) => a.id.localeCompare(b.id)),
    titles: mergeRecords(local.titles, remote.titles), aliases: mergeRecords(local.aliases, remote.aliases),
    ingredientTables: Object.fromEntries([...languages].map((language) => [language, {
      names: { ...local.ingredientTables[language]?.names, ...remote.ingredientTables[language]?.names },
      notes: { ...local.ingredientTables[language]?.notes, ...remote.ingredientTables[language]?.notes },
      units: { ...local.ingredientTables[language]?.units, ...remote.ingredientTables[language]?.units }
    }]))
  });
}

function mergeQueue(local: TranslationQueue, remote: TranslationQueue): TranslationQueue {
  const tasks = new Map(local.tasks.map((task) => [task.id, task]));
  for (const task of remote.tasks) {
    const previous = tasks.get(task.id);
    const contexts = new Map<string, QueueTask['recipes'][number]>();
    for (const context of [...previous?.recipes ?? [], ...task.recipes]) contexts.set(JSON.stringify([context.id, context.line]), context);
    tasks.set(task.id, { ...task, recipes: [...contexts.values()], firstSeen: previous && Date.parse(previous.firstSeen) < Date.parse(task.firstSeen) ? previous.firstSeen : task.firstSeen });
  }
  const held = remote.held.map((entry) => {
    const previous = local.held.find((held) => held.id === entry.id && held.since === entry.since);
    return previous?.notifiedAt && !entry.notifiedAt ? { ...entry, notifiedAt: previous.notifiedAt } : entry;
  });
  return validateTranslationQueue({ ...remote, issueNumber: remote.issueNumber ?? local.issueNumber,
    tasks: [...tasks.values()].sort((a, b) => a.id.localeCompare(b.id)), held });
}

function snapshot(repo: string, dir: string, gh: GhRunner) {
  let stage: string | undefined;
  try {
    stage = fs.mkdtempSync(path.join(dir, '.enrich-remote-'));
    restoreEnrichment(repo, stage, gh);
    return { learned: readLearnedData(path.join(stage, 'enrichment.json')), queue: readTranslationQueue(path.join(stage, 'translation-queue.json')) };
  } catch { throw new RemoteEnrichError('download'); }
  finally { if (stage) fs.rmSync(stage, { recursive: true, force: true }); }
}

export interface RemoteEnrichReport extends EnrichReport {
  deployment: 'triggered' | 'pending';
}

export async function runRemoteEnrich({ queueFile, learnedFile, model, repo, gh = runGh }: {
  queueFile: string; learnedFile: string; model: ModelConfig; repo: string; gh?: GhRunner
}): Promise<RemoteEnrichReport> {
  let local: { learned: LearnedData; queue: TranslationQueue };
  try {
    local = { learned: readLearnedData(learnedFile), queue: readTranslationQueue(queueFile) };
    fs.mkdirSync(path.dirname(learnedFile), { recursive: true });
  } catch { throw new RemoteEnrichError('local'); }
  const downloaded = snapshot(repo, path.dirname(learnedFile), gh);
  let report: EnrichReport;
  try {
    writeJSONAtomic(learnedFile, mergeLearned(local.learned, downloaded.learned));
    writeJSONAtomic(queueFile, mergeQueue(local.queue, downloaded.queue));
    report = await runLocalEnrich({ queueFile, learnedFile, model });
  } catch { throw new RemoteEnrichError('local'); }

  // A nightly build or another desktop may have published while the model was running.
  const latest = snapshot(repo, path.dirname(learnedFile), gh);
  let queue: TranslationQueue;
  try {
    const learned = mergeLearned(readLearnedData(learnedFile), latest.learned);
    queue = mergeQueue(readTranslationQueue(queueFile), latest.queue);
    queue.tasks = queue.tasks.filter((task) => !isTaskComplete(task, learned));
    writeJSONAtomic(learnedFile, learned);
    writeJSONAtomic(queueFile, queue);
  } catch { throw new RemoteEnrichError('local'); }
  try {
    gh(['release', 'upload', 'data', learnedFile, '--clobber', '--repo', repo]);
    gh(['release', 'upload', 'data', queueFile, '--clobber', '--repo', repo]);
  } catch { throw new RemoteEnrichError('upload'); }
  const remainingIds = new Set(queue.tasks.map((task) => task.id));
  const result = { ...report, remaining: queue.tasks.length, failed: report.failed.filter((failure) => remainingIds.has(failure.id)) };
  try {
    gh(['workflow', 'run', 'daily.yml', '--repo', repo, '--raw-field', 'crawl=false']);
    return { ...result, deployment: 'triggered' };
  } catch { return { ...result, deployment: 'pending' }; }
}
