/** Titles are cached once per original text and target UI language. */
export type TranslationMemory = Record<string, Record<string, string>>;

/** Optional display data, fetched after the language-neutral catalog. */
export interface LanguageOverlay {
  language: string;
  titles: Record<string, string>;
  ingredients?: import('./ingredient-display').IngredientTables;
}

export function translatedTitle(original: string, language: string, memory: TranslationMemory): string {
  return safeTranslation(original, memory[language]?.[original], language);
}

// These lists guard display text; the original-content publication checks stay independent.
const animals: Record<string, RegExp> = {
  en: /\b(?:eggs?|yolks?|butter|ghee|milk|cream|cheese|parmesan|cheddar|gorgonzola|brie|gouda|gruy[eè]re|halloumi|paneer|emmental|provolone|fontina|burrata|stracchino|mozzarella|feta|ricotta|mascarpone|pecorino|quark|yogh?urt|honey|gelatine?|chicken|beef|pork|bacon|ham|lamb|turkey|veal|duck|rabbit|venison|salami|pepperoni|chorizo|guanciale|mortadella|bresaola|sausage|prosciutto|pancetta|lard|fish|anchov(?:y|ies)|tuna|salmon|shrimp|prawns?|crab|lobster|scallops?|oysters?|clams?|mussels?|squid|cod|sardines?|whey|casein)\b/g,
  it: /\b(?:uov[oa]|tuorl[oi]|album[ei]|burro|ghee|latte|panna|formaggi[oi]|parmigiano|parmesan|cheddar|gorgonzola|brie|gouda|gruy[eè]re|halloumi|paneer|emmental|provolone|fontina|taleggio|burrata|stracchino|caciotta|caciocavallo|asiago|scamorza|caprino|grana|pecorino|mozzarella|feta|ricotta|mascarpone|quark|yogurt|miele|gelatina|colla di pesce|carne|pollo|manzo|maiale|bacon|prosciutto|pancetta|agnello|tacchino|vitello|anatra|coniglio|cervo|capretto|guanciale|mortadella|bresaola|cotechino|chorizo|salsicc[ei]a|salsicce|salame|salumi|strutto|pesce|acciug[ah]e?|alici|tonno|salmone|gamber(?:[oi]|ett[oi])|granch(?:io|i)|aragost[ae]|ostric[ah]e?|vongol[ae]|cozz[ae]|calamar[oi]|cap[ae]sant[ae]|merluzzo|sardine|siero|caseina)\b/g
};
const qualifiers: Record<string, RegExp> = {
  en: /\b(?:vegan|plant[ -]based|plant)\s*$/,
  it: /\b(?:vegan[oaie]?|vegetal[ei]|soia|tofu|seitan|tempeh)\s*$/
};
const plantPairs = /\b(?:(?:almond|coconut|oat|cashew|soy|soya|rice|pea|dairy[ -]free|non[ -]dairy)\s+(?:milk|cream|cheese|yogh?urt)|(?:peanut|almond|cashew|cocoa|shea|nut)\s+butter|(?:flax|chia|egg[ -]free)\s+eggs?|mushroom\s+cream)\s*$/;
const plantSuffixes = /^(?:butter\s+(?:beans?|lettuce)|oysters?\s+mushrooms?|cream\s+of tartar)\b/;
const suffixes: Record<string, RegExp> = {
  en: /^\s+(?:alternative|substitute|replacer)\b/,
  it: /^\s+(?:vegan[oaie]?|vegetal[ei]|di (?:soia|mandorl[ae]|avena|cocco|anacardi|arachidi|cacao|karit[eé]|riso|piselli))\b/
};

/** Check each named ingredient separately, so one plant qualifier cannot excuse another. */
export function findUnsafeRenderedTerms(text: string, language: string): string[] {
  const animal = animals[language];
  if (!animal) return [text];
  const hits: string[] = [];
  const normalized = text.normalize('NFC').toLowerCase().replace(/\p{Pd}/gu, '-');
  for (const part of normalized.split(/[,;:()!?]|\s+(?:and|with|or|e|con|o|&|\+)\s+/)) {
    const matches = [...part.matchAll(new RegExp(animal))];
    const usedQualifiers: [number, number][] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const previous = matches[i - 1];
      const before = part.slice(previous ? previous.index + previous[0].length : 0, match.index);
      const after = part.slice(match.index + match[0].length, matches[i + 1]?.index);
      if (language === 'en' && (plantPairs.test(`${before}${match[0]}`) || plantSuffixes.test(`${match[0]}${after}`))) continue;
      const prefix = qualifiers[language]!.exec(before);
      const suffix = suffixes[language]!.exec(after);
      const offsets = [
        ...(prefix ? [[match.index - before.length + prefix.index, match.index]] : []),
        ...(suffix ? [[match.index + match[0].length, match.index + match[0].length + suffix[0].length]] : [])
      ] as [number, number][];
      const qualifier = offsets.find(([start, end]) => !usedQualifiers.some(([a, b]) => start < b && end > a));
      if (qualifier) usedQualifiers.push(qualifier);
      else hits.push(match[0]);
    }
  }
  return hits;
}

export function safeTranslation(original: string, candidate: unknown, language: string): string {
  if (typeof candidate !== 'string' || !candidate.trim()) return original;
  const translated = candidate.trim();
  return findUnsafeRenderedTerms(translated, language).length ? original : translated;
}
