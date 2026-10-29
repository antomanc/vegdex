import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const env = { ...process.env, VEGDEX_DATA_FILE: path.join(root, 'e2e/fixtures/italian-data/recipes.full.json') } as Record<string, string>;
let client: Client;

beforeAll(async () => {
  client = new Client({ name: 'content-language-test', version: '0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/cli.ts', 'mcp'],
    cwd: path.join(root, 'packages/mcp'), env
  }));
}, 30_000);
afterAll(() => client?.close());

const call = async (name: string, args: Record<string, unknown>) => {
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse((result.content as { text: string }[])[0]!.text);
};

it('MCP filters mixed content languages and keeps English tool text and content metadata', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === 'search_vegan_recipes')!;
  expect(tool.title).toBe('Search vegan recipes');
  expect(tool.inputSchema.properties).toHaveProperty('contentLanguage');
  const filtered = await call('search_vegan_recipes', { text: 'chickpeas', contentLanguage: 'it', include: ['chickpeas'], exclude: ['mushrooms'] });
  expect(filtered.total).toBe(1);
  expect(filtered.recipes[0]).toMatchObject({ id: 'italian-chickpeas', contentLanguage: 'it', source: 'Cucina di prova' });
  const all = await call('search_vegan_recipes', { text: 'chickpeas', limit: 1 });
  expect(all.total).toBe(2);
  expect(all.recipes).toHaveLength(1);
  const english = await call('search_vegan_recipes', { text: 'chickpeas', contentLanguage: 'en' });
  expect(english.recipes).toMatchObject([{ id: 'quinoa-salad', contentLanguage: 'en' }]);
  const details = await call('get_vegan_recipes', { ids: ['italian-chickpeas', 'missing'] });
  expect(details[0]).toMatchObject({ contentLanguage: 'it', ingredients: ['400 g ceci, scolati e sciacquati', '1,5 cucchiai olio di oliva'] });
  expect(details[1]).toEqual({ id: 'missing', error: 'unknown recipe id' });
});

it('CLI accepts an optional content language while keeping English output and ingredient filters', () => {
  const run = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: path.join(root, 'packages/mcp'), encoding: 'utf8', env
  });
  expect(run('--help')).toContain('--language <code>');
  const italian = JSON.parse(run('search', 'chickpeas', '--language', 'it', '--have', 'chickpeas', '--avoid', 'mushrooms', '--json'));
  expect(italian.total).toBe(1);
  expect(italian.recipes[0]).toMatchObject({ id: 'italian-chickpeas', contentLanguage: 'it' });
  const all = JSON.parse(run('search', 'chickpeas', '--limit', '1', '--json'));
  expect(all.total).toBe(2);
  expect(all.recipes).toHaveLength(1);
  expect(JSON.parse(run('search', 'chickpeas', '--language', 'en', '--json')).recipes)
    .toMatchObject([{ id: 'quinoa-salad', contentLanguage: 'en' }]);
  expect(run('search', 'chickpeas', '--language', 'it')).toContain('1 recipes');
  expect(JSON.parse(run('show', 'italian-chickpeas', '--json'))[0]).toMatchObject({ contentLanguage: 'it' });
});
