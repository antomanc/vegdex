/** Curated parsing rules for each source's content language. */
import type { Meal } from './types';

export interface LanguagePack {
  units?: Record<string, string>;
  numberWords?: Record<string, number>;
  preposition?: RegExp;
  trailingNote?: RegExp;
  nonIngredient?: RegExp;
  optional?: RegExp;
  animalWords?: RegExp;
  qualifier?: RegExp;
  qualifierSuffix?: RegExp;
  meals?: [RegExp, Meal][];
  glutenFree?: RegExp;
  oilFree?: RegExp;
  cuisines?: Record<string, string>;
  ingredientRisks?: { nuts: RegExp; soy: RegExp; oil: RegExp; gluten: RegExp };
}

export const languagePacks: Record<string, LanguagePack> = {
  en: {},
  it: {
    units: {
      grammo: 'g', grammi: 'g', chilogrammo: 'kg', chilogrammi: 'kg', chilo: 'kg', chili: 'kg',
      millilitro: 'ml', millilitri: 'ml', litro: 'l', litri: 'l',
      cucchiaio: 'tbsp', cucchiai: 'tbsp', cucchiaino: 'tsp', cucchiaini: 'tsp',
      tazza: 'cup', tazze: 'cup', spicchio: 'clove', spicchi: 'clove',
      scatola: 'can', scatole: 'can', lattina: 'can', lattine: 'can', barattolo: 'jar', barattoli: 'jar',
      confezione: 'package', confezioni: 'package', mazzetto: 'bunch', mazzetti: 'bunch',
      fetta: 'slice', fette: 'slice', pizzico: 'pinch', pizzichi: 'pinch', pezzo: 'piece', pezzi: 'piece'
    },
    numberWords: { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, mezzo: 0.5, mezza: 0.5 },
    preposition: /^(?:di\s+|d['’]\s*)/i,
    trailingNote: /\s+((?:(?:cott[oaie]|scolat[oaie]|sciacquat[oaie]|tritat[oaie]|tagliat[oaie]|sbucciat[oaie]|grattugiat[oaie]|facoltativ[oaie])\b.*)|q\.?\s*b\.?|quanto basta)$/i,
    nonIngredient: /^(?:per (?:servire|guarnire|la decorazione)|nota|note|consiglio)\b/i,
    optional: /\b(?:facoltativ[oaie]|opzional[ei])\b/i,
    meals: [
      [/colazione|brunch/, 'breakfast'], [/zupp[ae]|minestr[ae]|minestrone|vellutat[ae]/, 'soup'],
      [/insalat[ae]/, 'salad'], [/contorn[oi]/, 'side'], [/antipast[oi]|spuntin[oi]|merenda/, 'snack'],
      [/dolc[ei]|tort[ae]|biscott[oi]|dessert|gelat[oi]|budin[oi]/, 'dessert'],
      [/pane|panini|focacci[ae]|lievitat[oi]/, 'baking'], [/bevanda|bevande|frullat[oi]|succhi|succo/, 'drink'],
      [/sals[ae]|condiment[oi]|pesto|hummus/, 'sauce'], [/primi|secondi|piatt[oi]|pranzo|cena|pasta|risotto|gnocchi/, 'main']
    ],
    glutenFree: /senza glutine|gluten[\s-]?free/i,
    oilFree: /senza olio|oil[\s-]?free/i,
    cuisines: { italiana: 'italian', mediterranea: 'mediterranean', indiana: 'indian', asiatica: 'asian', cinese: 'chinese', giapponese: 'japanese', messicana: 'mexican', francese: 'french', greca: 'greek', vegana: 'vegan' },
    ingredientRisks: {
      nuts: /\b(?:mandorl[ae]|anacardi|noci|noce(?! moscata)|nocciole?|pistacchi|pecan|macadamia|pinoli|arachidi|frutta a guscio)\b/i,
      soy: /\b(?:soia|tofu|tempeh|edamame|miso|tamari|shoyu)\b/i,
      oil: /\b(?:olio|oli|burro vegetale|margarina)\b/i,
      gluten: /\b(?:frumento|grano(?! saraceno)|farro|orzo|segale|semola|seitan|glutine(?!-free)|pangrattato|pane|birra)\b/i
    },
    animalWords: /\b(?:uov[oa]|tuorl[oi]|album[ei]|burro|ghee|latte|panna|formaggi[oi]|parmigiano|parmesan|cheddar|gorgonzola|brie|gouda|gruy[eè]re|halloumi|paneer|emmental|provolone|fontina|taleggio|burrata|stracchino|caciotta|caciocavallo|asiago|scamorza|caprino|grana|pecorino|mozzarella|feta|ricotta|mascarpone|quark|yogurt|miele|gelatina|colla di pesce|carne|pollo|manzo|maiale|bacon|prosciutto|pancetta|agnello|tacchino|vitello|anatra|coniglio|cervo|capretto|guanciale|mortadella|bresaola|cotechino|chorizo|salsicc[ei]a|salsicce|salame|salumi|strutto|pesce|acciug[ah]e?|alici|tonno|salmone|gamber(?:[oi]|ett[oi])|granch(?:io|i)|aragost[ae]|ostric[ah]e?|vongol[ae]|cozz[ae]|calamar[oi]|cap[ae]sant[ae]|merluzzo|sardine|siero|caseina)\b/g,
    qualifier: /\b(?:vegan[oaie]?|vegetal[ei]|soia|tofu|seitan|tempeh)\s*$/,
    qualifierSuffix: /^\s+(?:vegan[oaie]?|vegetal[ei]|di (?:soia|mandorl[ae]|avena|cocco|anacardi|arachidi|cacao|karit[eé]|riso|piselli))\b/
  }
};

export const languageUnitPatterns = Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.units).map(([code, p]) => [code,
  new RegExp(`^(${Object.keys(p.units!).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}])\\.?\\s*`, 'iu')
]));
