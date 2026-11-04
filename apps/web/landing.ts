// Static landing pages for search (#75): one per meal and per headline ingredient, in each UI language.
// Built from the emitted catalog; each page lists recipe titles that open in the app. No page per recipe.
import type { Locale } from './src/lib/locales.ts'

interface Catalog {
  sources: { id: string; name: string }[]
  concepts: string[]
  tags: string[]
  recipes: { id: string; title: string; source: string; contentLanguage: string; ratingCount: number | null; concepts: number[]; tags: number[] }[]
}
interface Dictionary { concepts: { id: string; names: Record<string, string[]> }[] }
interface Overlay { titles?: Record<string, string> }

/** Headline ingredients: the English name finds the concept; each language names the page. */
const INGREDIENTS: Record<string, string>[] = [
  { en: 'chickpeas', it: 'ceci' }, { en: 'lentils', it: 'lenticchie' }, { en: 'black beans', it: 'fagioli neri' },
  { en: 'tofu', it: 'tofu' }, { en: 'tempeh', it: 'tempeh' }, { en: 'cashews', it: 'anacardi' },
  { en: 'peanut butter', it: 'burro di arachidi' }, { en: 'coconut milk', it: 'latte di cocco' }, { en: 'oats', it: 'avena' },
  { en: 'quinoa', it: 'quinoa' }, { en: 'rice', it: 'riso' }, { en: 'pasta', it: 'pasta' },
  { en: 'potatoes', it: 'patate' }, { en: 'sweet potatoes', it: 'patate dolci' }, { en: 'mushrooms', it: 'funghi' },
  { en: 'spinach', it: 'spinaci' }, { en: 'cauliflower', it: 'cavolfiore' }, { en: 'broccoli', it: 'broccoli' },
  { en: 'zucchini', it: 'zucchine' }, { en: 'eggplant', it: 'melanzane' }, { en: 'avocado', it: 'avocado' },
  { en: 'banana', it: 'banane' }, { en: 'pumpkin', it: 'zucca' }, { en: 'dark chocolate', it: 'cioccolato fondente' }
]

const COPY: Record<string, { dir: string; ingredient: (name: string) => string; meal: (name: string) => string; intro: () => string; browse: string; home: string }> = {
  en: {
    dir: 'recipes',
    ingredient: (name) => `Vegan recipes with ${name}`,
    meal: (name) => `Vegan ${name.toLowerCase()}`,
    intro: () => `Recipes from vegan food blogs, collected by vegdex. Open one to see its ingredients, then cook it on the creator's site.`,
    browse: 'Browse and filter them all in vegdex',
    home: 'vegdex: vegan recipes from the best plant-based blogs'
  },
  it: {
    dir: 'ricette',
    ingredient: (name) => `Ricette vegane con ${name}`,
    meal: (name) => `Ricette vegane: ${name.toLowerCase()}`,
    intro: () => `Ricette dai blog di cucina vegana, raccolte da vegdex. Aprine una per vederne gli ingredienti, poi cucinala sul sito di chi l'ha creata.`,
    browse: 'Sfogliale e filtrale tutte in vegdex',
    home: 'vegdex: ricette vegane dai migliori blog vegetali'
  }
}
const MEALS = ['breakfast', 'main', 'soup', 'salad', 'side', 'snack', 'dessert', 'baking', 'drink', 'sauce']
const LIST = 60

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

export interface LandingPage { fileName: string; html: string; url: string; alternates: { language: string; url: string }[] }

export function landingPages(opts: {
  catalog: Catalog; dictionary: Dictionary; overlays: Record<string, Overlay>; locales: readonly Locale[]
  siteUrl: string; base: string; mealLabel: (locale: Locale, meal: string) => string
}): LandingPage[] {
  const { catalog, dictionary, overlays, locales, siteUrl, base } = opts
  for (const l of locales) if (!COPY[l.code] || INGREDIENTS.some((i) => !i[l.code])) throw new Error(`landing pages have no ${l.code} copy`)
  const prefix = (l: Locale) => (l.prefix ? `${l.prefix}/` : '')
  const sourceName = new Map(catalog.sources.map((s) => [s.id, s.name]))
  const conceptIndex = new Map(catalog.concepts.map((id, i) => [id, i]))
  const tagIndex = new Map(catalog.tags.map((t, i) => [t, i]))
  const byPopularity = [...catalog.recipes].sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))

  const topics = [
    ...MEALS.map((meal) => ({ tag: tagIndex.get(`meal:${meal}`), concept: undefined, meal, names: undefined as Record<string, string> | undefined })),
    ...INGREDIENTS.map((names) => {
      const id = dictionary.concepts.find((c) => c.names.en?.includes(names.en!))?.id
      return { tag: undefined, concept: id ? conceptIndex.get(id) : undefined, meal: undefined, names }
    })
  ]

  const pages: LandingPage[] = []
  for (const t of topics) {
    const recipes = byPopularity.filter((r) => (t.meal ? t.tag !== undefined && r.tags.includes(t.tag) : t.concept !== undefined && r.concepts.includes(t.concept)))
    if (recipes.length < 10) continue
    const name = (l: Locale) => (t.meal ? opts.mealLabel(l, t.meal) : t.names![l.code]!)
    const path = (l: Locale) => `${prefix(l)}${COPY[l.code]!.dir}/${slug(name(l))}/`
    const alternates = [...locales.map((l) => ({ language: l.hreflang, url: new URL(path(l), siteUrl).href })),
      { language: 'x-default', url: new URL(path(locales[0]!), siteUrl).href }]
    for (const l of locales) {
      const copy = COPY[l.code]!
      const title = t.meal ? copy.meal(name(l)) : copy.ingredient(name(l))
      const app = `${base}${prefix(l)}`
      const filter = t.meal ? `?meal=${t.meal}` : `?have=${encodeURIComponent(name(l))}`
      const shown = l.code === 'en' ? recipes : [...recipes.filter((r) => r.contentLanguage === l.code), ...recipes.filter((r) => r.contentLanguage !== l.code)]
      const items = shown.slice(0, LIST).map((r) => {
        const display = r.contentLanguage === l.code ? r.title : (overlays[l.code]?.titles?.[r.title] ?? r.title)
        return `<li><a href="${app}?r=${encodeURIComponent(r.id)}">${esc(display)}</a> <span>${esc(sourceName.get(r.source) ?? r.source)}</span></li>`
      }).join('\n')
      const url = new URL(path(l), siteUrl).href
      pages.push({
        fileName: `${path(l)}index.html`,
        url,
        alternates,
        html: `<!doctype html>
<html lang="${l.code}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} · vegdex</title>
<meta name="description" content="${esc(copy.intro())}" />
<link rel="canonical" href="${url}" />
${alternates.map((a) => `<link rel="alternate" hreflang="${a.language}" href="${a.url}" />`).join('\n')}
<link rel="icon" type="image/svg+xml" href="${base}favicon.svg" />
<meta name="theme-color" content="#1d4a31" />
<style>
body{margin:0 auto;max-width:42rem;padding:1.5rem 1rem 3rem;font:1rem/1.5 system-ui,sans-serif;background:#eef0e9;color:#1c241f}
a{color:#1d4a31}h1{font-size:1.6rem;line-height:1.2;margin:.5rem 0}ul{padding:0;list-style:none}li{padding:.45rem 0;border-bottom:1px solid #d5dacd}
li span{color:#5a6459;font-size:.875rem}.cta{display:inline-block;margin:.5rem 0 1rem;font-weight:600}
</style>
</head>
<body>
<a href="${app}">${esc(copy.home)}</a>
<h1>${esc(title)}</h1>
<p>${esc(copy.intro())}</p>
<a class="cta" href="${app}${filter}">${esc(copy.browse)} →</a>
<ul>
${items}
</ul>
</body>
</html>
`
      })
    }
  }
  return pages
}
