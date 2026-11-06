import { cleanText } from './text';
import { lookupTerm, type IngredientLookup } from './concepts';
import { languagePacks } from './languages';
import { normalizeLine, normalise } from './ingredients/normalise';
import { amount } from './ingredients/amount';
import { nameAndNotes } from './ingredients/name';
import { resolve } from './ingredients/resolve';
import { classify } from './ingredients/classify';
import { MEASURE_QUALIFIERS_RE, FILL_QUALIFIERS_RE } from './ingredients/measure';
import { type ParsedIngredient, type ParsedLine } from './ingredients/types';

export { normalizeLine };
export { unitDef } from './ingredients/units';
export { singularize, canonicalName } from './ingredients/names';
export type { Dimension, PreparationTerm, ParsedIngredient, ParsedLine } from './ingredients/types';

/** Cached parsed lines also need to retain qualifiers removed from their measure; an approximate amount is kept as `approx`. */
export function hasDroppedMeasureWords(p: ParsedIngredient): boolean {
  const words = p.approx ? FILL_QUALIFIERS_RE : MEASURE_QUALIFIERS_RE;
  const count = (text: string) => [...text.matchAll(words)].length;
  // Words in a note ("about 2.5 pounds") stay in the note; only those before the name were dropped.
  const kept = p.afterMeasure ?? (p.phrase !== undefined ? `${p.phrase} ${p.note}` : '');
  return count(p.raw) > count(kept);
}

/** "Garnish: chopped parsley", "spices: 1 tsp cumin": a label naming one ingredient. */
const OPTIONAL_LABEL_RE = /optio|garnish|topping|serv|add|extra|mix-in|decorat/i;
const LABEL_RE = /^((?:optional\s+|optioanl\s+)?[\p{L}][\p{L}&' -]{0,30}?)\s*:\s*(?=\S)/iu;

/** "Garnish: chopped parsley": a label naming one known ingredient, parsed from its remainder; null when not a label. */
function labelPart(raw: string, language: string, lookup: IngredientLookup): ParsedIngredient | null {
  if (language !== 'en') return null;
  const s = normalizeLine(raw).replace(/^\.(?=\d)/, '0.');
  const label = s.match(LABEL_RE);
  // Only a label naming one known ingredient is dropped; a list after it ("Garnish: parsley, lemon") stays as written.
  if (!label || /[,;(]/.test(s.slice(label[0].length))) return null;
  const inner = parseIngredient(s.slice(label[0].length), lookup, language);
  // "Toppings: basil" is shown as optional basil.
  const optionalId = OPTIONAL_LABEL_RE.test(label[1]!) ? lookupTerm('optional', lookup) : null;
  const terms = optionalId && !inner.terms?.some((t) => t.id === optionalId) ? [...inner.terms ?? [], { id: optionalId, text: 'optional' }] : inner.terms;
  if (inner.concept && inner.conceptExact) return { ...inner, terms, raw: cleanText(raw), optional: inner.optional || !!optionalId };
  return null;
}

/** Parse one published ingredient line into quantity, unit and canonical name. */
export function parseIngredient(raw: string, lookup: IngredientLookup = {}, language = 'en'): ParsedIngredient {
  const pack = languagePacks[language];
  if (!pack) throw new RangeError(`Unsupported content language: ${language}`);

  const labelled = labelPart(raw, language, lookup);
  if (labelled) return labelled;

  const normalised = normalise(raw, language, pack);
  const measured = amount(normalised, language, pack);
  const named = nameAndNotes(measured, language, pack, lookup);
  const resolved = resolve(named, measured, raw, language, lookup);
  return classify(raw, normalised.optional, measured, named, resolved);
}

/** The parts of a shipped line; datasets before parts hold one object per line. */
export const lineParts = (line: ParsedLine): ParsedIngredient[] => (Array.isArray(line) ? line : [line]);

/** Words besides "+", "&" and the language's "and" that join two measured ingredients. */
const PART_JOINERS: Record<string, string[]> = { en: ['plus', 'mixed with', 'whisked with', 'combined with'], it: ['più'] };
/** "zest of 1 lemon + 2 tbsp juice": a later part named only by what it takes from an earlier one. */
const BACK_REFERENCE = /^(?:juice|zest|sauce|brine|liquid|pulp|succo|scorza|salsa|sugo|liquido|polpa|salamoia)$/i;
/** "1 tsp each cumin, turmeric…": a part sharing its amount with a list that the part would drop. */
const SHARED_AMOUNT = /(?<!\p{L})(?:each|ciascun[oa]|ognuno)(?!\p{L})/iu;
/** "each" right after the amount, followed by a list; "(15 oz each)" sizing a package was taken out first. */
const SHARED_LIST = /^[^,(]*?(?<!\p{L})(?:each|ciascun[oa]|ognuno)(?!\p{L}).*?(?:[,&+(]|\s(?:and|e)\s)/iu;

/**
 * "2 tsp cornstarch + 2 tbsp water": a line naming several ingredients, each with its own amount, as its parts.
 * It splits only where every part is a known ingredient and each later part has its own amount; any other
 * line is one part, as parseIngredient reads it. A joiner inside brackets or after an alternative
 * ("tamari or 1 tsp miso + 2 tbsp water") never splits, and a label ("Smoky: …") applies to every part.
 */
export function parseLine(raw: string, lookup: IngredientLookup = {}, language = 'en'): ParsedIngredient[] {
  const pack = languagePacks[language];
  if (!pack) throw new RangeError(`Unsupported content language: ${language}`);
  const s = normalizeLine(raw);
  const label = language === 'en' ? s.match(LABEL_RE)?.[0] ?? '' : '';
  const body = s.slice(label.length);
  const words = [pack.and, ...(PART_JOINERS[language] ?? [])].map((w) => w.replace(/ /g, String.raw`\s+`));
  const joiner = new RegExp(String.raw`(?:\s*,)?\s*(?:\+|&|(?<!\p{L})(?:${words.join('|')})(?!\p{L}))\s*(?=\d)`, 'iuy');
  const points: [start: number, end: number][] = [];
  for (let i = 0, depth = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth = Math.max(depth - 1, 0);
    else if (depth === 0) {
      joiner.lastIndex = i;
      if (joiner.exec(body) && joiner.lastIndex > i) {
        points.push([i, joiner.lastIndex]);
        i = joiner.lastIndex - 1;
      }
    }
  }
  const shared = sharedAmountParts(body, label, lookup, language);
  if (shared) return shared;
  if (!points.length) return [whole(raw, lookup, language)];
  const alternative = new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu');
  const known = (p: ParsedIngredient) => !p.kind && !!p.concept && p.conceptExact === true;
  // A later part needs its own amount and its own name: "3 large cloves" after a head of garlic is not the spice.
  const own = (p: ParsedIngredient) => p.quantity !== null && !!p.phrase && !BACK_REFERENCE.test(p.name);
  const part = (text: string) => parseIngredient(`${label}${text}`, lookup, language);
  // The parts of body[from…], splitting at points[k…]; null when no split makes every part known.
  const split = (from: number, k: number): ParsedIngredient[] | null => {
    for (let j = k; j < points.length; j++) {
      const [start, end] = points[j]!;
      const text = body.slice(from, start);
      // "…, per me un radicchio e 150 g di cavolo nero": what the author used is commentary, not a second purchase.
      if (alternative.test(text.replace(/\([^)]*\)?/g, ' ')) || SHARED_AMOUNT.test(text) || /,\s*(?:per me|io)\s/i.test(text)) break;
      const p = part(text);
      if (!known(p) || (from > 0 && !own(p))) continue;
      const rest = split(end, j + 1);
      if (rest) return [p, ...rest];
    }
    if (from === 0) return null;
    const last = part(body.slice(from));
    return known(last) && own(last) && !SHARED_AMOUNT.test(body.slice(from)) ? [last] : null;
  };
  return split(0, 0) ?? [whole(raw, lookup, language)];
}

/** The line as one part. A shared-amount list ("1 tsp each salt, cumin") is more than its first item, so that name is not exact. */
function whole(raw: string, lookup: IngredientLookup, language: string): ParsedIngredient {
  const p = parseIngredient(raw, lookup, language);
  return p.conceptExact && !p.also && SHARED_LIST.test(p.raw.replace(/\([^()]*\)/g, (b) => (SHARED_AMOUNT.test(b) ? ' ' : b))) ? { ...p, conceptExact: false } : p;
}

/** "¼ tsp each onion powder (, garlic powder)": one part per listed item, each with the shared amount; null unless every item is known. */
function sharedAmountParts(body: string, label: string, lookup: IngredientLookup, language: string): ParsedIngredient[] | null {
  const m = body.match(/^([^,]*\d[^,]*?)\s+(?:each|ciascun[oa]|ognuno)\s*:?\s+([^\d]+)$/iu);
  const pack = languagePacks[language]!;
  // Only the amount comes before "each": "2 tsp seasoning (or 1 tsp each of …)" is an alternative.
  if (!m || /[()]/.test(m[1]!) || new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu').test(m[1]!)) return null;
  const list = m[2]!.replace(/[()]/g, ',');
  if (new RegExp(String.raw`(?<!\p{L})${pack.or}(?!\p{L})`, 'iu').test(list)) return null;
  const names = list.split(new RegExp(String.raw`\s*,\s*(?:(?:${pack.and}|&)\s+)?|\s+(?:${pack.and}|&)\s+`, 'iu')).map((n) => n.trim()).filter(Boolean);
  if (names.length < 2) return null;
  const read = (list: string[]) => {
    const parts = list.map((name) => parseIngredient(`${label}${m[1]} ${name}`, lookup, language));
    return parts.every((p) => !p.kind && !!p.concept && p.conceptExact === true) ? parts : null;
  };
  // "garlic & onion powder": one-word items may share the last item's noun, when that names what they are.
  const noun = language === 'en' ? names.at(-1)!.match(/\s(powder|seeds|flakes|leaves|extract)$/i)?.[1] : undefined;
  const shared = noun && read(names.map((n, i) => (i < names.length - 1 && !/\s/.test(n) ? `${n} ${noun}` : n)));
  return shared || read(names);
}
