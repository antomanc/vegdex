import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishStore, pullStore, type GhRunner } from '../src/release';

function fakeGh(fail: (args: string[]) => boolean = () => false) {
  const calls: { args: string[]; stdio?: string }[] = [];
  const gh: GhRunner = (args, stdio) => {
    calls.push({ args, stdio });
    if (fail(args)) throw new Error(`gh ${args.join(' ')} failed`);
  };
  return { gh, calls };
}

/** A store directory shaped like `.data/` after an emit. */
function emitted(assets: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-release-'));
  for (const asset of ['store.json.gz', 'excluded.json', ...assets]) fs.writeFileSync(path.join(dir, asset), '{}');
  return path.join(dir, 'store.json.gz');
}

describe('Data release', () => {
  it('pulls the store to the exact path this run reads', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vegdex-pull-'));
    const store = path.join(dir, 'nested', 'custom-store.json.gz');
    const { gh, calls } = fakeGh();
    pullStore(store, gh);
    expect(calls[0]!.args).toEqual(['release', 'download', 'data', '--pattern', 'store.json.gz', '--output', store, '--clobber']);
    expect(fs.existsSync(path.dirname(store))).toBe(true);
  });

  it('creates the release when the data release is missing, uploads the run outputs and deploys without a crawl', () => {
    const store = emitted(['crawl-report.json']);
    const { gh, calls } = fakeGh((args) => args[0] === 'release' && args[1] === 'view');
    publishStore(store, gh);
    expect(calls.map((c) => c.args.slice(0, 2))).toEqual([
      ['release', 'view'],
      ['release', 'create'],
      ['release', 'upload'],
      ['workflow', 'run']
    ]);
    expect(calls[0]!.stdio).toBe('ignore');
    expect(calls[2]!.args).toEqual(['release', 'upload', 'data', '--clobber', store,
      path.join(path.dirname(store), 'excluded.json'), path.join(path.dirname(store), 'crawl-report.json')]);
    expect(calls[3]!.args).toEqual(['workflow', 'run', 'daily.yml', '-f', 'crawl=false']);
  });

  it('stops before uploading when the release cannot be created', () => {
    const store = emitted([]);
    const { gh, calls } = fakeGh((args) => args[1] === 'view' || args[1] === 'create');
    expect(() => publishStore(store, gh)).toThrow();
    expect(calls.map((c) => c.args[1])).toEqual(['view', 'create']);
  });

  it('stops before dispatching when the upload fails', () => {
    const store = emitted([]);
    const { gh, calls } = fakeGh((args) => args[1] === 'upload');
    expect(() => publishStore(store, gh)).toThrow();
    expect(calls.map((c) => c.args[1])).toEqual(['view', 'upload']);
  });

  it('leaves the release alone when it exists and uploads without a report when there is none', () => {
    const store = emitted([]);
    const { gh, calls } = fakeGh();
    publishStore(store, gh);
    expect(calls.map((c) => c.args[1])).toEqual(['view', 'upload', 'run']);
    expect(calls[1]!.args.some((arg) => arg.endsWith('crawl-report.json'))).toBe(false);
  });

  it('refuses a store the workflow would not restore', () => {
    const { gh, calls } = fakeGh();
    expect(() => publishStore('/tmp/data/custom.gz', gh)).toThrow(/store\.json\.gz/);
    expect(calls).toEqual([]);
  });
});
