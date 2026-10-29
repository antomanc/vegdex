import {
  readLearnedData, readTranslationQueue, writeJSONAtomic,
} from './enrichment';
import { applyProposal, isTaskComplete, proposeEnrichment, type FailureReason, type ModelConfig } from './model';

export { isTaskComplete } from './model';

export interface EnrichReport {
  accepted: number;
  reused: number;
  remaining: number;
  failed: { id: string; reason: FailureReason }[];
}

/** Persist each accepted result before retiring its queue task, so interruption is resumable. */
export async function runLocalEnrich({ queueFile, learnedFile, model }: { queueFile: string; learnedFile: string; model: ModelConfig }): Promise<EnrichReport> {
  const queue = readTranslationQueue(queueFile);
  let learned = readLearnedData(learnedFile);
  const report: EnrichReport = { accepted: 0, reused: 0, remaining: queue.tasks.length, failed: [] };
  for (const task of [...queue.tasks]) {
    if (isTaskComplete(task, learned)) report.reused++;
    else {
      const result = await proposeEnrichment(task, model, learned);
      if (!result.ok) { report.failed.push({ id: task.id, reason: result.reason }); continue; }
      const next = applyProposal(task, result.proposal, learned);
      if (!isTaskComplete(task, next)) { report.failed.push({ id: task.id, reason: 'unfaithful-mapping' }); continue; }
      writeJSONAtomic(learnedFile, next);
      learned = next;
      report.accepted++;
    }
    queue.tasks = queue.tasks.filter((entry) => entry.id !== task.id);
    writeJSONAtomic(queueFile, queue);
  }
  report.remaining = queue.tasks.length;
  return report;
}
