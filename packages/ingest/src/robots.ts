export interface Robots {
  sitemaps: string[];
  crawlDelay: number | null;
  allowed(url: string): boolean;
}

interface Rule {
  allow: boolean;
  pattern: RegExp;
  length: number;
}

function toRegExp(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

/**
 * Minimal robots.txt (RFC 9309): groups for our agent or `*`, longest match wins,
 * Allow beats Disallow on ties.
 */
export function parseRobots(text: string, agent = 'vegdex'): Robots {
  const sitemaps: string[] = [];
  const groups: { agents: string[]; rules: Rule[]; delay: number | null }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if ((key === 'allow' || key === 'disallow') && value)
      current.rules.push({ allow: key === 'allow', pattern: toRegExp(value), length: value.length });
    if (key === 'crawl-delay' && Number.isFinite(Number(value))) current.delay = Number(value);
  }

  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const crawlDelay = chosen.map((g) => g.delay).find((d) => d !== null) ?? null;

  return {
    sitemaps,
    crawlDelay,
    allowed(url: string) {
      const u = new URL(url);
      const path = u.pathname + u.search;
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!rule.pattern.test(path)) continue;
        if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
      }
      return best ? best.allow : true;
    }
  };
}
