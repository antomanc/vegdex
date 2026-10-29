import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isQualifiedIngredient } from '@vegdex/core';
import { writeJSONAtomic, type QueueTask } from './enrichment';
import { modelConfig, proposeEnrichment, type EnrichmentProposal, type FailureReason } from './model';

interface EvaluationCase {
  id: string;
  kind: QueueTask['kind'];
  original: string;
  sourceLanguage: string;
  targetLanguage: string;
  source: { id: string; title: string; url: string; line?: string };
  terms?: string[][];
  conceptId?: string;
  qualifier?: boolean;
}
interface EvaluationResult extends Pick<QueueTask, 'id' | 'sourceLanguage' | 'targetLanguage'> {
  accepted: boolean;
  meaningHeuristic: boolean;
  qualifierPreserved?: boolean;
  reason?: FailureReason;
  proposal?: EnrichmentProposal;
}
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const safetyReasons: FailureReason[] = ['unsafe-translation', 'qualification-lost'];

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: 'boolean' }, label: { type: 'string' }, identity: { type: 'string' },
    'server-version': { type: 'string' }, 'report-dir': { type: 'string' }
  } });
  if (values.help) {
    console.log('pnpm eval:enrichment --label <run-name> --identity <model-file/revision/quantization> --server-version <version> [--report-dir <directory>]\nUses ENRICH_BASE_URL, ENRICH_MODEL and optional ENRICH_API_KEY. Writes <label>.eval.json to .data/evaluation by default. No learned data is read or written.');
    return;
  }
  if (!values.label || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(values.label) || !values.identity?.trim() || !values['server-version']?.trim()) throw new Error('Missing evaluation identity');
  const config = modelConfig();
  if (config.apiKey && [values.label, values.identity, values['server-version'], config.model, config.baseURL].some((value) => value?.includes(config.apiKey!))) throw new Error('Secret in report metadata');
  const root = path.resolve(import.meta.dirname, '../../..');
  const directory = path.resolve(root, values['report-dir'] ?? '.data/evaluation');
  const reportFile = path.join(directory, `${values.label}.eval.json`);
  if (fs.existsSync(reportFile)) throw new Error('Report already exists');
  // Record only the origin and pathname; modelConfig rejects embedded credentials and queries.
  const endpoint = new URL(config.baseURL);
  const sample = JSON.parse(fs.readFileSync(new URL('../data/enrichment-evaluation.json', import.meta.url), 'utf8')) as { version: number; cases: EvaluationCase[] };
  const cases: EvaluationResult[] = [];
  const started = new Date().toISOString();
  for (const entry of sample.cases) {
    const context = { id: entry.id, sourceLanguage: entry.sourceLanguage, targetLanguage: entry.targetLanguage };
    const task: QueueTask = { ...context, kind: entry.kind, original: entry.original, firstSeen: started, recipes: [entry.source] };
    const result = await proposeEnrichment(task, config);
    if (!result.ok) {
      cases.push({ ...context, accepted: false, reason: result.reason, meaningHeuristic: false, ...(entry.qualifier ? { qualifierPreserved: false } : {}) });
      continue;
    }
    const proposal = result.proposal;
    const translated = 'text' in proposal ? proposal.text ?? '' : '';
    const meaning = (!entry.conceptId || (proposal.kind === 'ingredient' && proposal.conceptId === entry.conceptId)) &&
      (entry.terms ?? []).every((variants) => variants.some((term) => normalize(translated).includes(normalize(term))));
    const qualifier = entry.qualifier ? isQualifiedIngredient(translated) : undefined;
    cases.push({ ...context, accepted: true, proposal, meaningHeuristic: meaning, ...(entry.qualifier ? { qualifierPreserved: qualifier } : {}) });
  }
  const score = (results: EvaluationResult[]) => ({
    meaningHeuristic: { passed: results.filter((r) => r.meaningHeuristic).length, total: results.length },
    responseValidity: { passed: results.filter((r) => r.accepted).length, total: results.length },
    qualifierPreservation: { passed: results.filter((r) => r.qualifierPreserved).length, total: results.filter((r) => r.qualifierPreserved !== undefined).length },
    safetyFailures: results.filter((r) => r.reason !== undefined && safetyReasons.includes(r.reason)).length
  });
  const scores = score(cases);
  const byDirection = Object.fromEntries([...new Set(cases.map((c) => `${c.sourceLanguage}->${c.targetLanguage}`))]
    .map((direction) => [direction, score(cases.filter((c) => `${c.sourceLanguage}->${c.targetLanguage}` === direction))]));
  const report = { evaluationVersion: sample.version, startedAt: started, finishedAt: new Date().toISOString(),
    model: config.model, identity: values.identity, serverVersion: values['server-version'], endpoint: `${endpoint.origin}${endpoint.pathname}`,
    settings: { directions: Object.keys(byDirection), temperature: 0, maxTokens: 1024, timeoutMs: config.timeoutMs ?? 120_000 },
    scores, byDirection,
    limitations: 'Meaning is a curated lexical/concept heuristic, not proof of faithful translation. Response validity means production validation accepted the proposal. Review every accepted proposal and failure in both directions before choosing a model. No GPU or VRAM measurement is made by this command.', cases };
  // A secret echoed through identity, URL path or model metadata must not enter a report either.
  const serialized = JSON.stringify(report);
  if (config.apiKey && serialized.includes(config.apiKey)) throw new Error('Secret in report');
  writeJSONAtomic(reportFile, report);
  console.log(`Meaning heuristic ${scores.meaningHeuristic.passed}/${cases.length}; response validity ${scores.responseValidity.passed}/${cases.length}; qualifiers ${scores.qualifierPreservation.passed}/${scores.qualifierPreservation.total}; safety failures ${scores.safetyFailures}.`);
  for (const [direction, result] of Object.entries(byDirection))
    console.log(`${direction}: meaning ${result.meaningHeuristic.passed}/${result.meaningHeuristic.total}; response validity ${result.responseValidity.passed}/${result.responseValidity.total}; qualifiers ${result.qualifierPreservation.passed}/${result.qualifierPreservation.total}; safety failures ${result.safetyFailures}.`);
  console.log('Review the saved evaluation report before choosing a model.');
  if (scores.meaningHeuristic.passed < cases.length || scores.responseValidity.passed < cases.length || scores.qualifierPreservation.passed < scores.qualifierPreservation.total || scores.safetyFailures) process.exitCode = 1;
}

main().catch(() => {
  console.error('Evaluation failed. Check the endpoint, required identity options and unused report label. Provider responses and configuration are not printed.');
  process.exitCode = 1;
});
