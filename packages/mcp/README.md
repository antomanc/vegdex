# vegdex MCP server and CLI

Search vegan recipes, retrieve ingredient quantities and combine recipes into a shopping list. Each recipe links to its publisher for cooking instructions.

The npm package is not yet published. From a checkout of [vegdex](https://github.com/antomanc/vegdex), install dependencies and build the CLI:

```bash
pnpm install --frozen-lockfile
pnpm --filter @antomanc/vegdex build
```

## MCP

Use the absolute path to the built CLI in your client's stdio configuration:

```json
{
  "mcpServers": {
    "vegdex": {
      "command": "node",
      "args": ["/absolute/path/to/vegdex/packages/mcp/dist/cli.js", "mcp"]
    }
  }
}
```

| Tool | Purpose |
| --- | --- |
| `search_vegan_recipes` | Search by text, meal, time, ingredients and other filters |
| `get_vegan_recipes` | Get ingredient lines, servings, time and nutrition for up to 20 recipe IDs |
| `compile_grocery_list` | Scale recipes and combine ingredients by aisle |
| `list_vegan_sources` | List the blogs in the index and the dataset date |

The dataset does not include cooking methods. Follow the recipe URL for instructions. Dietary filters are derived from recipe data, so check the source for allergens.

## CLI

Run these commands from the repository root:

```bash
node packages/mcp/dist/cli.js search "peanut noodles" --max 30
node packages/mcp/dist/cli.js search gnocchi --language it
node packages/mcp/dist/cli.js search --meal breakfast --flavor savory --protein --have tofu
node packages/mcp/dist/cli.js show <id>
node packages/mcp/dist/cli.js grocery <id>:4 <id>:2  # id:target-servings
node packages/mcp/dist/cli.js --help
```

The dataset is downloaded on first use and refreshed daily in `~/.cache/vegdex`. If a refresh fails, the cached copy is used. Set `VEGDEX_DATA_URL` or `VEGDEX_DATA_FILE` to use another dataset.
