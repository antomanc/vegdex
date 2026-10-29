import { FLAVORS, FREE_FROM, MEALS, type FullDataset } from '@vegdex/core'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getRecipes, groceryList, search, sources } from './tools'

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] })

export async function startServer(load: () => Promise<FullDataset>, version: string) {
  let data: Promise<FullDataset> | null = null
  // Load lazily so the server answers `initialize` instantly, even on first download.
  const dataset = () => (data ??= load().catch((err) => ((data = null), Promise.reject(err))))

  const server = new McpServer(
    { name: 'vegdex', version },
    {
      instructions:
        'vegdex indexes real, tested recipes from established vegan food blogs. Every recipe is vegan. ' +
        'Use search_vegan_recipes to find candidates, get_vegan_recipes for exact ingredient lines, and ' +
        'compile_grocery_list to merge ingredients across recipes. Recipes contain no method text: always ' +
        'give the user the recipe url for the instructions, and do not invent steps.'
    }
  )

  server.registerTool(
    'search_vegan_recipes',
    {
      title: 'Search vegan recipes',
      description:
        'Search tested vegan recipes from top vegan blogs by text, meal, flavor, time, allergens and ingredients. ' +
        'Returns summaries with ids; free-from and high-protein tags are derived from ingredients and nutrition data, so confirm on the source for allergies.',
      inputSchema: {
        text: z.string().optional().describe('Free text matched against titles and ingredients, e.g. "lasagna" or "peanut noodles"'),
        contentLanguage: z.string().optional().describe('Content language code, e.g. "en" or "it"; omit to search every language'),
        meals: z.array(z.enum(MEALS)).optional().describe('Any of these meal types'),
        flavor: z.enum(FLAVORS).optional(),
        maxMinutes: z.number().int().positive().optional().describe('Maximum total time in minutes'),
        freeFrom: z.array(z.enum(FREE_FROM)).optional(),
        highProtein: z.boolean().optional().describe('Only recipes with at least 20 g protein per serving'),
        include: z.array(z.string()).optional().describe('Ingredients that must all be used, e.g. ["tofu", "spinach"]'),
        exclude: z.array(z.string()).optional().describe('Ingredients to avoid, e.g. ["mushroom", "coconut"]'),
        cuisine: z.string().optional().describe('e.g. "indian", "italian", "mexican"'),
        minRating: z.number().min(0).max(5).optional(),
        sort: z.enum(['relevance', 'rating', 'newest', 'fastest']).optional(),
        limit: z.number().int().min(1).max(50).optional().describe('Default 10')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args) => json(search(await dataset(), args))
  )

  server.registerTool(
    'get_vegan_recipes',
    {
      title: 'Get recipe ingredients',
      description: 'Full ingredient lines (with quantities), servings, time and nutrition for up to 20 recipe ids.',
      inputSchema: { ids: z.array(z.string()).min(1).max(20) },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ ids }) => json(getRecipes(await dataset(), ids))
  )

  server.registerTool(
    'compile_grocery_list',
    {
      title: 'Compile grocery list',
      description:
        'Merge the ingredients of several recipes into one shopping list grouped by aisle, with quantities summed and unit-converted. ' +
        'Scale each recipe with servings (target servings) or multiplier.',
      inputSchema: {
        recipes: z
          .array(
            z.object({
              id: z.string(),
              servings: z.number().positive().optional().describe('Target servings; scales from the recipe yield'),
              multiplier: z.number().positive().optional().describe('Direct scale factor; overrides servings')
            })
          )
          .min(1)
          .max(30)
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args) => json(groceryList(await dataset(), args))
  )

  server.registerTool(
    'list_vegan_sources',
    {
      title: 'List recipe sources',
      description: 'The vegan blogs in the index, with recipe counts and the dataset date.',
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => json(sources(await dataset()))
  )

  await server.connect(new StdioServerTransport())
}
