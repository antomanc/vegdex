import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isQualifiedIngredient } from '@vegdex/core';
import { writeJSONAtomic, type QueueTask } from './enrichment';
import { modelConfig, proposeEnrichment, type FailureReason } from './model';

interface EvaluationCase {
  id: string;
  kind: QueueTask['kind'];
  original: string;
  source: { id: string; title: string; url: string; line?: string };
  terms?: string[][];
  conceptId?: string;
  qualifier?: boolean;
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
  const cases = [];
  let meaningPassed = 0, validityPassed = 0, qualifierPassed = 0, safetyFailures = 0;
  const started = new Date().toISOString();
  for (const entry of sample.cases) {
    const task: QueueTask = { id: entry.id, kind: entry.kind, original: entry.original, sourceLanguage: 'en', targetLanguage: 'it', firstSeen: started, recipes: [entry.source] };
    const result = await proposeEnrichment(task, config);
    if (!result.ok) {
      if (safetyReasons.includes(result.reason)) safetyFailures++;
      cases.push({ id: entry.id, accepted: false, reason: result.reason, meaningHeuristic: false, ...(entry.qualifier ? { qualifierPreserved: false } : {}) });
      continue;
    }
    validityPassed++;
    const proposal = result.proposal;
    const translated = 'text' in proposal ? proposal.text ?? '' : '';
    const meaning = (!entry.conceptId || (proposal.kind === 'ingredient' && proposal.conceptId === entry.conceptId)) &&
      (entry.terms ?? []).every((variants) => variants.some((term) => normalize(translated).includes(normalize(term))));
    const qualifier = entry.qualifier ? isQualifiedIngredient(translated) : undefined;
    if (meaning) meaningPassed++;
    if (qualifier) qualifierPassed++;
    cases.push({ id: entry.id, accepted: true, proposal, meaningHeuristic: meaning, ...(entry.qualifier ? { qualifierPreserved: qualifier } : {}) });
  }
  const total = sample.cases.length;
  const report = { evaluationVersion: sample.version, startedAt: started, finishedAt: new Date().toISOString(),
    model: config.model, identity: values.identity, serverVersion: values['server-version'], endpoint: `${endpoint.origin}${endpoint.pathname}`,
    settings: { sourceLanguage: 'en', targetLanguage: 'it', temperature: 0, maxTokens: 1024, timeoutMs: config.timeoutMs ?? 120_000 },
    scores: { meaningHeuristic: { passed: meaningPassed, total }, responseValidity: { passed: validityPassed, total },
      qualifierPreservation: { passed: qualifierPassed, total: sample.cases.filter((entry) => entry.qualifier).length }, safetyFailures },
    limitations: 'Meaning is a curated lexical/concept heuristic, not proof of faithful Italian. Response validity means production validation accepted the proposal. Review every accepted proposal and failure before choosing a model. No GPU or VRAM measurement is made by this command.', cases };
  // A secret echoed through identity, URL path or model metadata must not enter a report either.
  const serialized = JSON.stringify(report);
  if (config.apiKey && serialized.includes(config.apiKey)) throw new Error('Secret in report');
  writeJSONAtomic(reportFile, report);
  console.log(`Meaning heuristic ${meaningPassed}/${total}; response validity ${validityPassed}/${total}; qualifiers ${qualifierPassed}/${report.scores.qualifierPreservation.total}; safety failures ${safetyFailures}.`);
  console.log('Review the saved evaluation report before choosing a model.');
  if (meaningPassed < total || validityPassed < total || qualifierPassed < report.scores.qualifierPreservation.total || safetyFailures) process.exitCode = 1;
}

main().catch(() => {
  console.error('Evaluation failed. Check the endpoint, required identity options and unused report label. Provider responses and configuration are not printed.');
  process.exitCode = 1;
});
