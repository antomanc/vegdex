import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { score, type Coverage } from './gaps';

/** Process boundary: tests replace gh, never the ingest logic. */
export type GhRunner = (args: string[], input?: string) => string;
export const runGh: GhRunner = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });

export interface HeldRecipe {
  id: string;
  title: string;
  url: string;
}

const TITLE = 'Translation backlog';
const marker = (id: string) => `<!-- held:${createHash('sha256').update(id).digest('hex')} -->`;

export function backlogBody(coverage: Coverage, held: HeldRecipe[]): string {
  const rows = Object.entries(coverage.languages).map(([language, c]) => {
    const s = score(c);
    return `| ${language} | ${s.rendered}% of ${c.lines} | ${s.unknown}% | ${c.unnamed} | ${s.titles}% of ${c.titles} |`;
  });
  const gaps = Object.entries(coverage.top).flatMap(([language, top]) => top.length
    ? [`\n**${language}**\n`, ...top.map((g) => `- ${g.kind} \`${g.id}\`: ${g.lines} lines`)] : []);
  return [
    TITLE, '',
    'How much of each language vegdex can show, for recipes written in another language. A line counts when every part of it comes from the vocabulary; otherwise it is shown as written.', '',
    '| Language | Lines rendered | Unknown ingredients | Lines missing a name | Titles translated |',
    '| --- | --- | --- | --- | --- |',
    ...rows, '',
    `Held recipes (not published until every ingredient is known): ${held.length}`, '',
    '## Largest gaps', ...gaps, '',
    'Fill them with `pnpm gaps` and `pnpm vocab:apply`, or `pnpm enrich` (docs/agents/vocabulary.md).', ''
  ].join('\n');
}

/** Routine edits mention nobody; each newly held recipe is mentioned once, deduplicated by a marker comment. */
export function updateBacklog(coverage: Coverage, held: HeldRecipe[], repo: string, gh = runGh): number {
  const issues = JSON.parse(gh(['issue', 'list', '--repo', repo, '--state', 'all', '--search', `in:title "${TITLE}"`, '--json', 'number,title', '--limit', '100'])) as { number: number; title: string }[];
  let number = issues.find((issue) => issue.title === TITLE)?.number;
  const body = backlogBody(coverage, held);
  if (number) gh(['issue', 'edit', String(number), '--repo', repo, '--body-file', '-'], body);
  else {
    number = Number(gh(['issue', 'create', '--repo', repo, '--title', TITLE, '--body-file', '-'], body).trim().split('/').at(-1));
    if (!Number.isInteger(number) || number <= 0) throw new Error(`Could not identify the ${TITLE} issue`);
  }
  if (held.length) {
    const comments = gh(['api', `repos/${repo}/issues/${number}/comments`, '--paginate', '--jq', '.[].body']);
    const fresh = held.filter((r) => !comments.includes(marker(r.id)));
    if (fresh.length) gh(['issue', 'comment', String(number), '--repo', repo, '--body-file', '-'],
      `@${repo.split('/')[0]} These recipes are held until vegdex knows every ingredient:\n\n${fresh.map((r) => `- [${r.title}](${r.url}) ${marker(r.id)}`).join('\n')}\n`);
  }
  return number;
}
