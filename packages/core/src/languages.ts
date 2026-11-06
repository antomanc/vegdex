/** Curated parsing and grammar rules for each language. */
import type { Meal } from './types';
import type { Gender } from './vocabulary';

export interface LanguagePack {
  /** "sale e pepe", "noci o mandorle": the words joining two ingredients. */
  and: string;
  or: string;
  /** "about 2 cups", "circa 2 tazze". */
  about: string;
  /** "circa 1 litro d'acqua": the word before an amount that means "about". */
  circa?: RegExp;
  /** Genders that preparation terms agree with; absent when they don't agree. */
  genders?: Gender[];
  /** "large carrots": descriptive words come before the noun; otherwise after it ("carote grandi"). */
  adjectivesFirst?: boolean;
  /** "2 cucchiai di olio", "200 g di farina": the word joining a unit to the ingredient. */
  unitLink?: string;
  /** Units that count pieces of the ingredient, by gender: notes agree with them ("4 spicchi di aglio, tritati"). */
  countUnits?: Record<string, Gender>;
  units?: Record<string, string>;
  /** "cucchiaino colmo", "a testa": how full a spoon is, or per person, written after the unit. */
  fillNote?: RegExp;
  numberWords?: Record<string, number>;
  /** "oppure" → "o", "il succo di mezzo limone" → "mezzo limone": shapes rewritten so the parser reads them. */
  shapes?: (text: string, leading: string[]) => string;
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

/**
 * Italian shapes rewritten to ones the parser reads, with what they said moved to `leading` notes:
 * "il succo di mezzo limone" → "mezzo limone" (juiced), "qualche foglia di salvia" → "salvia" (to taste),
 * "farina di tipo 0, 1 o 2" → "farina 0", "un bel pizzico" → "un pizzico", "oppure" → "o".
 */
function italianShapes(text: string, leading: string[]): string {
  let s = text.replace(/(?<!\p{L})oppure(?!\p{L})/giu, 'o');
  const part = s.match(/^(?:(?:il|la)\s+|un\s+cucchiaino\s+(?:di\s+|della\s+))?(succo|scorza)(?:\s+grattugiata)?\s+(?:di|del|della)\s+(un[oa]?|mezz[oa]|1\/2|\d+(?:[.,]\d+)?)\s+(limon[ei]|lim[ei]|arance?|aranc[ia]a)\b(?:\s+(?:bio(?:logic[oaie])?|non\s+trattat[oaie]))?\s*/iu);
  if (part && !/^(?:\+|,|e\s)/.test(s.slice(part[0].length))) {
    leading.push(part[1]!.toLowerCase() === 'succo' ? 'spremuto' : 'solo la scorza');
    s = `${part[2]} ${part[3]}${s.slice(part[0].length) ? ` ${s.slice(part[0].length)}` : ''}`;
  }
  const few = s.match(/^qualche\s+(?:(?:foglia|fogliolina|rametto|goccia|chicco|ciuffo)\s+(?:di\s+|d['’]\s*)?)?/i);
  if (few) {
    leading.push('quanto basta');
    s = s.slice(few[0].length);
  }
  s = s.replace(/\bfarina\s+(?:bianca\s+)?(?:di\s+)?tipo\s+(00|0|1|2)\b(?:\s*(?:,|o)\s*(?:(?:la\s+)?tipo\s+)?(?:00|0|1|2|integrale)\b)*/i, (_, type: string) => `farina tipo ${type}`);
  return s.replace(/^(un[oa]?|1)\s+(?:bel|buon|grande|abbondante)\s+(?=pizzic|mazzett|manciat)/i, '$1 ');
}

export const languagePacks: Record<string, LanguagePack> = {
  en: { and: 'and', or: 'or', about: 'about', adjectivesFirst: true },
  it: {
    and: 'e',
    or: 'o',
    about: 'circa',
    circa: /^circa\s+(?=\d|un[oa']?\s|mezz[oa]\s)/i,
    genders: ['m', 'f'],
    unitLink: 'di',
    countUnits: { clove: 'm', slice: 'f', piece: 'm', stalk: 'm', head: 'm' },
    units: {
      grammo: 'g', grammi: 'g', chilogrammo: 'kg', chilogrammi: 'kg', chilo: 'kg', chili: 'kg',
      millilitro: 'ml', millilitri: 'ml', litro: 'l', litri: 'l',
      cucchiaio: 'tbsp', cucchiai: 'tbsp', cucchiaino: 'tsp', cucchiaini: 'tsp',
      tazza: 'cup', tazze: 'cup', spicchio: 'clove', spicchi: 'clove',
      scatola: 'can', scatole: 'can', lattina: 'can', lattine: 'can', barattolo: 'jar', barattoli: 'jar',
      confezione: 'package', confezioni: 'package', mazzetto: 'bunch', mazzetti: 'bunch',
      fetta: 'slice', fette: 'slice', pizzico: 'pinch', pizzichi: 'pinch', pezzo: 'piece', pezzi: 'piece',
      bustina: 'sachet', bustine: 'sachet', vasetto: 'jar', vasetti: 'jar', rotolo: 'roll', rotoli: 'roll',
      costa: 'stalk', coste: 'stalk', foglia: 'leaf', foglie: 'leaf', foglioline: 'leaf', manciata: 'handful', manciate: 'handful',
      panetto: 'block', panetti: 'block', cespo: 'head', cespi: 'head', ciuffo: 'bunch', ciuffetto: 'bunch', ciuffi: 'bunch',
      rametto: 'sprig', rametti: 'sprig', centimetro: 'cm', centimetri: 'cm'
    },
    numberWords: { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, mezzo: 0.5, mezza: 0.5 },
    fillNote: /^(colm[oaie]|abbondant[ei]|ras[oaie]|scars[oaie]|grand[ei]|piccol[oaie]|a testa|circa)\s+/i,
    shapes: italianShapes,
    preposition: /^(?:di\s+|d['’]\s*)/i,
    trailingNote: /\s+((?:(?:già|ben)\s+)?(?:(?:(?:pre)?cott[oaie]|scolat[oaie]|sciacquat[oaie]|tritat[oaie]|tagliat[oaie]|sbucciat[oaie]|grattugiat[oaie]|facoltativ[oaie]|bio(?:logic[oaie])?|da\s+\d|pesat[oaie]|ammollat[oaie]|divis[oaie]|sciolt[oaie]|spremut[oaie]|meglio\s+se|circa|a\s+(?:piacere|scelta|pezzi|rondelle|bastoncino|straccetti)|di\s+(?:medie|grandi|piccole)\s+dimensioni|per\s+(?:decorare|guarnire|servire|impanare|finire|completare|rivestire|allungare|aiutarsi|la|il|le|lo|i|gli)\b|come\s+quest[oa])(?![a-zà-ù]).*)|q\.?\s*b\.?(?:\s+per\s.*)?|quanto basta|\+\s+q\.?\s*b\.?(?:\s+ma comunque meno possibile)?)$/i,
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
    qualifierSuffix: /^\s+(?:vegan[oaie]?|vegetal[ei]|veg(?![\wà-ÿ])|(?:di |d['’]|al |alla |all['’]|a base di )(?:soia|mel[ae]|nocciol[ae]|frutta secca|mandorl[ae]|avena|cocco|anacardi|arachidi|cacao|karit[eé]|riso|piselli|tofu|tempeh|seitan|ceci|lenticchie|fagioli|jackfruit|funghi))\b/
  }
};

export const languageUnitPatterns = Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.units).map(([code, p]) => [code,
  new RegExp(`^(${Object.keys(p.units!).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}])\\.?\\s*`, 'iu')
]));
