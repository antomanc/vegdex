import type { Batch } from './fill';

export interface ModelConfig {
  /** API base URL, including /v1 when the server uses that prefix. */
  baseURL: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export function modelConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  if (!env.ENRICH_BASE_URL || !env.ENRICH_MODEL) throw new Error('Set ENRICH_BASE_URL and ENRICH_MODEL');
  let url: URL;
  try { url = new URL(env.ENRICH_BASE_URL); } catch { throw new Error('Invalid model base URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid model base URL');
  return { baseURL: url.href.replace(/\/$/, ''), model: env.ENRICH_MODEL, ...(env.ENRICH_API_KEY ? { apiKey: env.ENRICH_API_KEY } : {}) };
}

/**
 * Ask any OpenAI-compatible endpoint to answer one batch. Returns the answers, or null when the response
 * is unusable; apply checks every answer, so nothing here is trusted.
 */
export async function answerBatch(batch: Batch, config: ModelConfig): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
      signal: AbortSignal.timeout(config.timeoutMs ?? 300_000),
      body: JSON.stringify({ model: config.model, stream: false, temperature: 0, messages: [
        { role: 'system', content: batch.instructions },
        { role: 'user', content: JSON.stringify({ context: batch.context, items: batch.items }) }
      ] })
    });
  } catch { return null; }
  if (!response.ok) return null;
  try {
    const body = await response.text();
    if (config.apiKey && body.includes(config.apiKey)) return null;
    const content: unknown = JSON.parse(body)?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    // Models sometimes wrap JSON in a code fence.
    const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const value: unknown = JSON.parse(json);
    const answers = value && typeof value === 'object' && 'answers' in value ? value.answers : null;
    return answers && typeof answers === 'object' && !Array.isArray(answers) ? answers as Record<string, unknown> : null;
  } catch { return null; }
}
