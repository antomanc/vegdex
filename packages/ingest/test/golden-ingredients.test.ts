import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { goldenLine, type GoldenFile, type GoldenLine } from '../src/golden-lines';
import { loadVocabulary } from '../src/vocab';

// The golden file lives with the parser's own tests; this suite loads it from packages/ingest because only
// that package can load the real vocabulary the way the emit does (@vegdex/core cannot depend on its consumer).
const file = new URL('../../core/test/golden/ingredient-lines.json', import.meta.url);
const golden = JSON.parse(fs.readFileSync(file, 'utf8')) as GoldenFile;
const vocab = loadVocabulary();

const show = (value: unknown) => JSON.stringify(value);

function describeLine(line: GoldenLine): string {
  return `${line.contentLanguage}: ${line.line}`;
}

/** Compare the output a reader sees; ok and unreviewed lines also lock the parsed fields behind it. */
function changed(stored: GoldenLine, current: ReturnType<typeof goldenLine>, fields: boolean): string[] {
  const out: string[] = [];
  if (current.en !== stored.en) out.push(`  en stored ${show(stored.en)}\n  en now    ${show(current.en)}`);
  if (current.it !== stored.it) out.push(`  it stored ${show(stored.it)}\n  it now    ${show(current.it)}`);
  if (fields && show(current.parsed) !== show(stored.parsed)) out.push(`  parsed stored ${show(stored.parsed)}\n  parsed now    ${show(current.parsed)}`);
  return out;
}

describe('golden ingredient lines', () => {
  it('locks every ok and unreviewed line and watches known-bad ones for their fix', () => {
    const failures: string[] = [];
    for (const stored of golden.lines) {
      const current = goldenLine(stored.line, stored.contentLanguage, vocab, golden.units);
      const line = describeLine(stored);
      if (stored.status !== 'known-bad') {
        const diff = changed(stored, current, true);
        if (diff.length) failures.push(`${stored.status.toUpperCase()} ${line}\n${diff.join('\n')}`);
        continue;
      }
      if (!stored.expected) {
        failures.push(`KNOWN-BAD without expected correction: ${line}`);
        continue;
      }
      const fixed = current.en === stored.expected.en && current.it === stored.expected.it;
      const untouched = current.en === stored.en && current.it === stored.it;
      if (fixed) {
        failures.push(`PROMOTE ${line}\n  now matches the expected correction; set status to ok and run \`pnpm golden --update\`.`);
      } else if (!untouched) {
        failures.push(`KNOWN-BAD changed but does not match expected: ${line}\n${changed(stored, current, false).join('\n')}\n  expected en ${show(stored.expected.en)}\n  expected it ${show(stored.expected.it)}`);
      }
    }
    expect(failures, `Golden ingredient output changed. Review below, then run \`pnpm golden --update\` only for intended changes.\n\n${failures.join('\n\n')}`).toEqual([]);
  });

  it('has the hand-reviewed shape the checklist expects', () => {
    const counts = { randomEnglish: 0, hard: 0, italianSource: 0, total: golden.lines.length };
    if (counts.total !== 500) throw new Error(`expected 500 golden lines, found ${counts.total}`);
    if (golden.lines.filter((l) => l.contentLanguage === 'en').length !== 400) throw new Error('expected 400 English-source lines');
    if (golden.lines.filter((l) => l.contentLanguage === 'it').length !== 100) throw new Error('expected 100 Italian-source lines');
    if (golden.lines.filter((l) => l.status === 'known-bad').length === 0) throw new Error('expected known-bad lines');
    for (const line of golden.lines.filter((l) => l.status === 'known-bad')) {
      if (!line.class || !line.expected) throw new Error(`known-bad line without class or expected: ${describeLine(line)}`);
    }
  });
});
