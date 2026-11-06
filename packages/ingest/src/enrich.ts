import type { Batch } from './fill';

export interface ModelConfig {
  /** API base URL, including /v1 when the server uses that prefix. */
  baseURL: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

/** Process boundary: tests replace fetch, never the parsing. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function modelConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  if (!env.ENRICH_BASE_URL || !env.ENRICH_MODEL) throw new Error('Set ENRICH_BASE_URL and ENRICH_MODEL');
  let url: URL;
  try { url = new URL(env.ENRICH_BASE_URL); } catch { throw new Error('Invalid model base URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid model base URL');
  return { baseURL: url.href.replace(/\/$/, ''), model: env.ENRICH_MODEL, ...(env.ENRICH_API_KEY ? { apiKey: env.ENRICH_API_KEY } : {}) };
}

/** Ask any OpenAI-compatible endpoint; returns the assistant's text, or null when the response is unusable. */
async function askModel(config: ModelConfig, system: string, user: string, fetchFn: FetchLike): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchFn(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
      signal: AbortSignal.timeout(config.timeoutMs ?? 300_000),
      body: JSON.stringify({ model: config.model, stream: false, temperature: 0, messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ] })
    });
  } catch { return null; }
  if (!response.ok) return null;
  try {
    const body = await response.text();
    if (config.apiKey && body.includes(config.apiKey)) return null;
    const content: unknown = JSON.parse(body)?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch { return null; }
}

/**
 * Ask any OpenAI-compatible endpoint to answer one batch. Returns the answers, or null when the response
 * is unusable; apply checks every answer, so nothing here is trusted.
 */
export async function answerBatch(batch: Batch, config: ModelConfig, fetchFn: FetchLike = fetch): Promise<Record<string, unknown> | null> {
  const content = await askModel(config, batch.instructions, JSON.stringify({ context: batch.context, items: batch.items }), fetchFn);
  if (content === null) return null;
  try {
    // Models sometimes wrap JSON in a code fence.
    const json = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const value: unknown = JSON.parse(json);
    const answers = value && typeof value === 'object' && 'answers' in value ? (value as { answers?: unknown }).answers : null;
    return answers && typeof answers === 'object' && !Array.isArray(answers) ? answers as Record<string, unknown> : null;
  } catch { return null; }
}

/** Ask the endpoint to read ingredient lines; returns the raw answer (JSON Lines), or null. */
export async function answerLines(config: ModelConfig, instructions: string, rows: string[], fetchFn: FetchLike = fetch): Promise<string | null> {
  return askModel(config, instructions, rows.join('\n'), fetchFn);
}
