/** Curated parsing and grammar rules for each language. */
import type { Meal } from './types';
import type { Gender } from './vocabulary';

export interface LanguagePack {
  /** "sale e pepe", "noci o mandorle": the words joining two ingredients. */
  and: string;
  or: string;
  /** Genders that preparation terms agree with; absent when they don't agree. */
  genders?: Gender[];
  /** "large carrots": descriptive words come before the noun; otherwise after it ("carote grandi"). */
  adjectivesFirst?: boolean;
  /** "2 cucchiai di olio": the word joining a unit to the ingredient, except after the listed units. */
  unitLink?: { word: string; except: string[] };
  units?: Record<string, string>;
  numberWords?: Record<string, number>;
  preposition?: RegExp;
  trailingNote?: RegExp;
  nonIngredient?: RegExp;
  unsafeLearnedAlias?: RegExp;
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
  en: { and: 'and', or: 'or', adjectivesFirst: true },
  it: {
    and: 'e',
    or: 'o',
    genders: ['m', 'f'],
    unitLink: { word: 'di', except: ['g', 'kg', 'ml', 'l', 'cm'] },
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
    trailingNote: /\s+((?:(?:cott[oaie]|scolat[oaie]|sciacquat[oaie]|tritat[oaie]|tagliat[oaie]|sbucciat[oaie]|grattugiat[oaie]|facoltativ[oaie])\b.*)|q\.?\s*b\.?|quanto basta|\+\s+q\.?\s*b\.?(?:\s+ma comunque meno possibile)?)$/i,
    nonIngredient: /^(?:per (?:servire|guarnire|la decorazione)|nota|note|consiglio)\b/i,
    unsafeLearnedAlias: /\b(?:o|e|con|per|oppure|facoltativ[oaie]|piccol[oaie]|medi[oaie]|grand[ei]|inter[oaie]|mezz[oaie]|tritat[oaie]|tagliat[oaie]|sbucciat[oaie]|grattugiat[oaie]|fresc[hoaie]+|surgelat[oaie]|essiccat[oaie]|divis[oaie]|più)\b/i,
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
    animalWords: /\b(?:uov[oa]|tuorl[oi]|album[ei]|burro|ghee|latte|panna|formaggi[oi]|parmigiano|parmesan|cheddar|gorgonzola|brie|gouda|gruy[eè]re|halloumi|paneer|emmental|provolone|fontina|taleggio|burrata|stracchino|caciotta|caciocavallo|asiago|scamorza|caprino|grana|pecorino|mozzarella|feta|ricotta|mascarpone|quark|yogurt|latticello|kefir|maionese|cacio|miele|gelatina|colla di pesce|caglio|carn[ei]|lardo|speck|w[uü]rstel|fegato|trippa|ciccioli|cappone|poll[oi]|manz[oi]|maial[ei]|bacon|prosciutt[oi]|pancetta|agnell[oi]|tacchin[oi]|vitell[oi]|anatr[ae]|conigli[o]?|cerv[oi]|caprett[oi]|guanciale|mortadella|bresaola|cotechino|chorizo|salsicc[ei]a|salsicce|salam[ei]|salumi|strutto|pesc[ei]|acciug[ah]e?|alici|tonn[oi]|salmon[ei]|gamber(?:[oi]|ett[oi])|granch(?:io|i)|aragost[ae]|ostric[ah]e?|vongol[ae]|cozz[ae]|calamar[oi]|cap[ae]sant[ae]|merluzz[oi]|baccal[aà]|sardin[ae]|trot[ae]|aringh[ae]|sgombr[oi]|polp[oi]|sepp(?:ia|ie)|frutti di mare|worcestershire|siero|caseina)(?![\wà-ÿ])/g,
    qualifier: /\b(?:vegan[oaie]?|vegetal[ei]|soia|tofu|seitan|tempeh|in stile|tipo|senza|funghi)\s*$/,
    qualifierSuffix: /^\s+(?:vegan[oaie]?|vegetal[ei]|(?:di |d['’]|al |alla |all['’]|a base di )(?:soia|mandorl[ae]|avena|cocco|anacardi|arachidi|cacao|karit[eé]|riso|piselli|tofu|tempeh|seitan|ceci|lenticchie|fagioli|jackfruit|funghi))\b/
  }
};

export const languageUnitPatterns = Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.units).map(([code, p]) => [code,
  new RegExp(`^(${Object.keys(p.units!).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}])\\.?\\s*`, 'iu')
]));
