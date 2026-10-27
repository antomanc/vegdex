import { FLAVORS, FREE_FROM, MEALS, type Flavor, type FreeFrom, type Meal } from '@vegdex/core'
import { parseArgs } from 'node:util'
import { loadDataset } from './dataset'
import { startServer } from './server'
import { getRecipes, groceryList, search, sources } from './tools'

const VERSION = '0.1.0'
const err = (msg: string) => process.stderr.write(msg + '\n')

const HELP = `vegdex ${VERSION}: vegan recipes from the best vegan blogs

Usage:
  vegdex mcp                         Start the MCP server (stdio)
  vegdex search [text] [options]     Search recipes
  vegdex show <id...>                Ingredients and details
  vegdex grocery <id[:servings]...>  Combined shopping list
  vegdex sources                     Blogs in the index

Search options:
  --meal <m,...>      ${MEALS.join(', ')}
  --flavor <f>        ${FLAVORS.join(', ')}
  --max <minutes>     Maximum total time
  --free <f,...>      ${FREE_FROM.join(', ')}
  --protein           At least 20 g protein per serving
  --have <i,...>      Must use these ingredients
  --avoid <i,...>     Must not use these ingredients
  --sort <s>          relevance, rating, newest, fastest
  --limit <n>         Default 10
  --json              Machine-readable output

Data: downloaded once a day to ~/.cache/vegdex. Override with VEGDEX_DATA_URL or VEGDEX_DATA_FILE.`

const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (!command || command === 'help' || command === '--help' || command === '-h') return console.log(HELP)
  if (command === '--version' || command === '-v') return console.log(VERSION)
  if (command === 'mcp') return startServer(() => loadDataset(err), VERSION)

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      meal: { type: 'string' },
      flavor: { type: 'string' },
      max: { type: 'string' },
      free: { type: 'string' },
      protein: { type: 'boolean' },
      have: { type: 'string' },
      avoid: { type: 'string' },
      sort: { type: 'string' },
      limit: { type: 'string' },
      json: { type: 'boolean' }
    }
  })
  const data = await loadDataset(err)
  const out = (value: unknown, pretty: () => string) => console.log(values.json ? JSON.stringify(value, null, 1) : pretty())

  if (command === 'search') {
    const result = search(data, {
      text: positionals.join(' ') || undefined,
      meals: list(values.meal) as Meal[] | undefined,
      flavor: values.flavor as Flavor | undefined,
      maxMinutes: values.max ? Number(values.max) : undefined,
      freeFrom: list(values.free) as FreeFrom[] | undefined,
      highProtein: values.protein,
      include: list(values.have),
      exclude: list(values.avoid),
      sort: values.sort as 'rating' | undefined,
      limit: values.limit ? Number(values.limit) : 10
    })
    return out(result, () =>
      [
        `${result.total} recipes`,
        ...result.recipes.map(
          (r) =>
            `\n${r.title}  [${r.id}]\n  ${r.source} · ${r.minutes ? `${r.minutes} min · ` : ''}${r.rating ? `★ ${r.rating} (${r.ratingCount})` : 'unrated'}\n  ${r.url}`
        )
      ].join('\n')
    )
  }
  if (command === 'show') {
    const result = getRecipes(data, positionals)
    return out(result, () =>
      result
        .map((r) =>
          'error' in r ? `${r.id}: ${r.error}` : `${r.title} (${r.source})\n${r.url}\n${r.ingredients.map((l) => `  - ${l}`).join('\n')}`
        )
        .join('\n\n')
    )
  }
  if (command === 'grocery') {
    const recipes = positionals.map((p) => {
      const [id, servings] = p.split(':')
      return { id: id!, servings: servings ? Number(servings) : undefined }
    })
    const result = groceryList(data, { recipes })
    return out(result, () =>
      Object.entries(result.aisles)
        .map(([aisle, items]) => `${aisle.toUpperCase()}\n${items.map((i) => `  [ ] ${i.item}: ${i.amount}`).join('\n')}`)
        .join('\n\n')
    )
  }
  if (command === 'sources') {
    const result = sources(data)
    return out(result, () =>
      [`${result.totalRecipes} recipes, updated ${result.generatedAt.slice(0, 10)}`, ...result.sources.map((s) => `  ${s.name} (${s.recipes})  ${s.url}`)].join('\n')
    )
  }
  err(`Unknown command "${command}".\n\n${HELP}`)
  process.exitCode = 1
}

main().catch((e: Error) => {
  err(`vegdex: ${e.message}`)
  process.exit(1)
})
