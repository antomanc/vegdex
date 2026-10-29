import { expect, it } from 'vitest';
import type { Coverage } from '../src/gaps';
import { updateBacklog, type GhRunner } from '../src/nightly';

const coverage: Coverage = {
  languages: { it: { lines: 200, rendered: 150, unknown: 30, unnamed: 15, kept: 5, titles: 10, translatedTitles: 4 } },
  top: { it: [{ kind: 'name', id: 'off:1', lines: 12 }], en: [{ kind: 'map', id: 'mystery seeds', lines: 9 }] }
};

function fakeGh(comments: string[] = [], issues = [{ number: 7, title: 'Translation backlog' }]) {
  const calls: { args: string[]; input?: string }[] = [];
  const gh: GhRunner = (args, input) => {
    calls.push({ args, input });
    if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(issues);
    if (args[0] === 'issue' && args[1] === 'create') return 'https://github.com/o/r/issues/9\n';
    if (args[0] === 'api') return comments.join('\n');
    return '';
  };
  return { gh, calls };
}

it('rewrites the backlog body with scores and gaps, mentioning nobody', () => {
  const { gh, calls } = fakeGh();
  expect(updateBacklog(coverage, [], 'o/r', gh)).toBe(7);
  const edit = calls.find((c) => c.args[1] === 'edit')!;
  expect(edit.args).toEqual(['issue', 'edit', '7', '--repo', 'o/r', '--body-file', '-']);
  expect(edit.input).toContain('| it | 75% of 200 | 15% | 15 | 40% of 10 |');
  expect(edit.input).toContain('- map `mystery seeds`: 9 lines');
  expect(edit.input).not.toContain('@');
  expect(calls.some((c) => c.args[1] === 'comment')).toBe(false);
});

it('creates the issue once and mentions each held recipe only the first time', () => {
  const held = [{ id: 'a', title: 'Gnocchi', url: 'https://x/a' }, { id: 'b', title: 'Fudge', url: 'https://x/b' }];
  const first = fakeGh([], []);
  expect(updateBacklog(coverage, held, 'o/r', first.gh)).toBe(9);
  const comment = first.calls.find((c) => c.args[1] === 'comment')!;
  expect(comment.input).toMatch(/^@o These recipes/);
  expect(comment.input).toContain('[Gnocchi](https://x/a)');
  const markers = comment.input!.match(/<!-- held:[0-9a-f]+ -->/g)!;
  const later = fakeGh([`old comment ${markers[0]}`]);
  updateBacklog(coverage, held, 'o/r', later.gh);
  const second = later.calls.find((c) => c.args[1] === 'comment')!;
  expect(second.input).toContain('Fudge');
  expect(second.input).not.toContain('Gnocchi');
  const quiet = fakeGh(markers);
  updateBacklog(coverage, held, 'o/r', quiet.gh);
  expect(quiet.calls.some((c) => c.args[1] === 'comment')).toBe(false);
});
