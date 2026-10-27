export const USER_AGENT = 'vegdex/0.1 (+https://github.com/antomanc/vegdex; vegan recipe index, links back to every recipe)';

export interface FetchResult {
  status: number;
  url: string;
  text: string;
}

export async function fetchText(url: string, timeoutMs = 20_000): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs)
      });
      const text = res.ok ? await res.text() : '';
      if (res.status >= 500 && attempt === 0) continue;
      return { status: res.status, url: res.url, text };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Serializes requests to one host with a fixed gap between them. */
export class HostQueue {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private gapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}
