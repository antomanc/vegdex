# A line with two amounts splits into parts

Some ingredient lines name two ingredients, each with its own amount: "2 tsp cornstarch + 2 tbsp water", "1 cup flour plus 2 tbsp cornstarch". About 870 catalog lines read like this. The parser gave each line one amount, so the second ingredient and its amount were left in the name, the line did not match a concept, and it stayed as written in every other language. The grocery list counted the first ingredient only.

The parser now turns such a line into parts. `parseLine` returns one `ParsedIngredient` per part, and each part is an ordinary ingredient with its own amount, concept and terms. The shipped `parsedIngredients[i]` is either one object (most lines) or an array of parts for raw line `i`, so the raw lines and their parses keep the same positions. Readers accept both shapes, so datasets built before this change keep working.

A line splits at "+", "plus", "and", "&" or "mixed with" only when the right side has its own amount and both sides map to a concept. Otherwise it stays one line as before. A split whose sides do not both map would turn one line kept as written into a half-translated pair. Lines with one amount keep using `also` ("salt and pepper to taste"). Alternatives that each have an amount ("1 tbsp fresh thyme or ½ tsp dried") are not split: the second option is still dropped as commentary, because two lines would read as needing both.

In the recipe's own language the line is shown as written. In another language each part is a line of its own. The shopping list adds each part to its own row. Coverage counts a raw line as rendered only when every part renders, and gaps report the part that does not.

## Considered Options

- **Give `also` an amount.** It covers two ingredients and no more, and every consumer of `also` needs new amount handling.
- **A `parts` list on one `ParsedIngredient`.** It is as general, but each consumer has to walk parts inside a line that otherwise looks like one ingredient.
- **Rewrite the raw `ingredients` into split lines.** It is simplest for consumers, but the original text no longer matches what the source wrote.

## Consequences

Each consumer of `parsedIngredients` takes the parts for a line instead of one object. A parser change can now move lines in or out of splitting, so `pnpm parse:diff <ref>` compares every catalog line under two parser versions before a change lands.
