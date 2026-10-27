# @antomanc/vegdex

Vegan recipes from established vegan food blogs, for AI agents and the terminal. Your assistant
searches real, tested recipes (with exact ingredient quantities and links to the creators)
instead of making them up, and can merge several of them into one shopping list.

## MCP

```json
{ "mcpServers": { "vegdex": { "command": "npx", "args": ["-y", "@antomanc/vegdex", "mcp"] } } }
```

Claude Code: `claude mcp add vegdex -- npx -y @antomanc/vegdex mcp`

| Tool | Does |
| --- | --- |
| `search_vegan_recipes` | Text, meal, sweet/savory, max minutes, gluten/nut/soy/oil-free, high protein, must-use and avoid ingredients, cuisine, rating |
| `get_vegan_recipes` | Exact ingredient lines, servings, time and nutrition for up to 20 ids |
| `compile_grocery_list` | Combines recipes, scales each to target servings, sums quantities and groups them by aisle |
| `list_vegan_sources` | The blogs in the index and the dataset date |

Recipes don't include the method. Agents should send the user to the recipe URL for the steps.

## CLI

```bash
npx @antomanc/vegdex search "peanut noodles" --max 30
npx @antomanc/vegdex search --meal breakfast --flavor savory --protein --have tofu
npx @antomanc/vegdex show <id>
npx @antomanc/vegdex grocery <id>:4 <id>:2      # id:target-servings
```

The dataset (a few MB) is downloaded on first use and refreshed daily into `~/.cache/vegdex`.
If a refresh fails, the cached copy is used. You can point it elsewhere with `VEGDEX_DATA_URL` or
`VEGDEX_DATA_FILE`.
