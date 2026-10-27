import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../..')
let client: Client

beforeAll(async () => {
  client = new Client({ name: 'test', version: '0' })
  await client.connect(
    new StdioClientTransport({
      command: 'npx',
      args: ['tsx', path.join(root, 'packages/mcp/src/cli.ts'), 'mcp'],
      cwd: path.join(root, 'packages/mcp'),
      env: { ...process.env, VEGDEX_DATA_FILE: path.join(root, 'e2e/fixtures/data/recipes.full.json') } as Record<string, string>
    })
  )
}, 30_000)

afterAll(() => client?.close())

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = await client.callTool({ name, arguments: args })
  return JSON.parse((res.content as { text: string }[])[0]!.text)
}

describe('vegdex MCP server', () => {
  it('lists the four tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compile_grocery_list', 'get_vegan_recipes', 'list_vegan_sources', 'search_vegan_recipes'
    ])
  })

  it('searches with ingredient and time constraints', async () => {
    const res = await call('search_vegan_recipes', { include: ['tofu'], exclude: ['mushroom'], maxMinutes: 30 })
    expect(res.total).toBe(1)
    expect(res.recipes[0]).toMatchObject({ id: 'tofu-curry', source: 'Vegan Richa', url: 'https://example.com/tofu-curry/' })
  })

  it('returns exact ingredient lines and flags unknown ids', async () => {
    const res = await call('get_vegan_recipes', { ids: ['lentil-soup', 'nope'] })
    expect(res[0].ingredients).toContain('4 cups vegetable broth')
    expect(res[1]).toEqual({ id: 'nope', error: 'unknown recipe id' })
  })

  it('scales by target servings when compiling a grocery list', async () => {
    const res = await call('compile_grocery_list', { recipes: [{ id: 'tofu-curry', servings: 8 }, { id: 'mushroom-stirfry' }] })
    const produce = Object.fromEntries(res.aisles.produce.map((i: { item: string; amount: string }) => [i.item, i.amount]))
    expect(produce.garlic).toBe('8 cloves')
    expect(res.recipes[0].multiplier).toBe(2)
  })

  it('rejects invalid arguments', async () => {
    const res = await client.callTool({ name: 'search_vegan_recipes', arguments: { meals: ['brunchy'] } })
    expect(res.isError).toBe(true)
  })
})
