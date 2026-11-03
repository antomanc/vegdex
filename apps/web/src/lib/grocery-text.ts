interface ListText {
  title: string
  /** As shown: aisles in order, each item's name and amount already in the page's language and units. */
  aisles: { label: string; items: { name: string; amount: string; checked: boolean }[] }[]
  recipesHeading: string
  recipes: { title: string; excluded: boolean }[]
}

// The sheet capitalizes in CSS; plain text has to do it itself.
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** The shopping list as plain text to paste anywhere: what is left to grab, aisle by aisle, then what it is for. */
export function groceryListText({ title, aisles, recipesHeading, recipes }: ListText): string {
  const blocks = [title]
  for (const aisle of aisles) {
    const left = aisle.items.filter((item) => !item.checked)
    if (!left.length) continue
    blocks.push([capitalize(aisle.label), ...left.map((item) => `- ${capitalize(item.name)}${item.amount ? `: ${item.amount}` : ''}`)].join('\n'))
  }
  const titles = recipes.filter((r) => !r.excluded).map((r) => `- ${r.title}`)
  if (titles.length) blocks.push([recipesHeading, ...titles].join('\n'))
  return blocks.join('\n\n')
}
