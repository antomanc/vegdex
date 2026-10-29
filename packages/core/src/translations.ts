import { languagePacks } from './languages';
// These lists guard display text. Original Italian content reuses its language pack's list as its text check (vegan.ts).
const animals: Record<string, RegExp> = {
  en: /\b(?:eggs?|yolks?|butter|ghee|milk|cream|cheese|parmesan|cheddar|gorgonzola|brie|gouda|gruy[eè]re|halloumi|paneer|emmental|provolone|fontina|burrata|stracchino|mozzarella|feta|ricotta|mascarpone|pecorino|quark|yogh?urt|honey|gelatine?|buttermilk|kefir|mayonnaise|chicken|beef|goat|mutton|pork|bacon|ham|lamb|turkey|veal|duck|rabbit|venison|salami|pepperoni|chorizo|guanciale|mortadella|bresaola|sausage|prosciutto|pancetta|lard|fish|anchov(?:y|ies)|tuna|salmon|shrimp|prawns?|crab|lobster|scallops?|oysters?|clams?|mussels?|squid|cod|sardines?|trout|herring|mackerel|octopus|seafood|worcestershire|whey|casein)\b/g,
  ...Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.animalWords).map(([code, p]) => [code, p.animalWords!]))
};
// English qualifiers count anywhere earlier in the ingredient ("vegan ground beef"); other languages' sit just before it.
const qualifiers: Record<string, RegExp> = {
  en: /\b(?:vegan|plant[ -]based|plant|dairy[ -]free|non[ -]?dairy|meatless|meat[ -]free)\b(?!.*\b(?:vegan|plant|dairy[ -]free|non[ -]?dairy|meatless|meat[ -]free)\b)/,
  ...Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.qualifier).map(([code, p]) => [code, p.qualifier!]))
};
const plantPairs = /\b(?:(?:almond|coconut|oat|cashew|soy|soya|rice|pea|dairy[ -]free|non[ -]dairy)\s+(?:whipped\s+)?(?:milk|cream|cheese|yogh?urt)|(?:peanut|almond|cashew|cocoa|shea|nut|seed|sunflower|sunflower seed|pumpkin seed|coconut|hazelnut|pistachio|walnut|pecan|macadamia|apple)\s+butter|(?:flax|chia|egg[ -]free)\s+eggs?|mushroom\s+cream)\s*$/;
const plantSuffixes = /^(?:butter\s+(?:beans?|lettuce)|oysters?\s+mushrooms?|cream\s+of tartar)\b/;
// A following qualifier may sit up to two words later ("carne macinata vegetale").
const nearby = (suffix: RegExp) => new RegExp(`^(?:\\s+[^\\s]+){0,2}?${suffix.source.slice(1)}`, suffix.flags);
const suffixes: Record<string, RegExp> = {
  en: nearby(/^\s+(?:alternative|substitute|replacer)\b/),
  ...Object.fromEntries(Object.entries(languagePacks).filter(([, p]) => p.qualifierSuffix).map(([code, p]) => [code, nearby(p.qualifierSuffix!)]))
};

/** Check each named ingredient separately, so one plant qualifier cannot excuse another. */
export function findUnsafeRenderedTerms(text: string, language: string): string[] {
  const animal = animals[language];
  if (!animal) return [text];
  const hits: string[] = [];
  const normalized = text.normalize('NFC').toLowerCase().replace(/\p{Pd}/gu, '-').replace(/[“”"]/g, '');
  for (const part of normalized.split(/[,;:()!?]|\s+(?:and|with|or|e|con|o|&|\+)\s+/)) {
    const matches = [...part.matchAll(new RegExp(animal))];
    const usedQualifiers: [number, number][] = [];
    let previousQualified = false;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      const previous = matches[i - 1];
      const before = part.slice(previous ? previous.index + previous[0].length : 0, match.index);
      const after = part.slice(match.index + match[0].length, matches[i + 1]?.index);
      if (language === 'en' && (plantPairs.test(`${before}${match[0]}`) || plantSuffixes.test(`${match[0]}${after}`))) {
        previousQualified = true;
        continue;
      }
      // "vegan cheddar cheese" names one cheese.
      if (language === 'en' && previousQualified && /^\s+$/.test(before) && /^cheeses?$/.test(match[0])) continue;
      const prefix = qualifiers[language]!.exec(before);
      const suffix = suffixes[language]!.exec(after);
      const offsets = [
        ...(prefix ? [[match.index - before.length + prefix.index, match.index]] : []),
        ...(suffix ? [[match.index + match[0].length, match.index + match[0].length + suffix[0].length]] : [])
      ] as [number, number][];
      const qualifier = offsets.find(([start, end]) => !usedQualifiers.some(([a, b]) => start < b && end > a));
      previousQualified = !!qualifier;
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
