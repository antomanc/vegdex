import type { LanguagePack } from '../languages';
import { languagePacks } from '../languages';
import { isQualifiedIngredient, lookupBrand, lookupConcept, lookupTerm, type IngredientLookup } from '../concepts';
import { nearName } from '../spelling';
import { findUnsafeRenderedTerms } from '../translations';
import { canonicalName } from './names';
import { lookupUnit, unitDef } from './units';
import { parseNumber } from './measure';
import type { ParsedIngredient, PreparationTerm } from './types';
import type { NameResult } from './name';
import type { AmountResult } from './amount';

export type Resolution = { concept: string | null; conceptExact: boolean; phrase: string; terms: PreparationTerm[]; also: ParsedIngredient['also']; size: ParsedIngredient['size'] };

/** "romano or ramiro pepper": a one-word first option shares the noun when that names a known ingredient. */
const SHARED_NOUN_RE = /^\s*([\p{L}'-]+)\s+or\s+[\p{L}'-]+(?:\s+[\p{L}'-]+)*\s+([\p{L}'-]+)\s*$/iu;
/** "lime/lemon juice", "nuts/seeds": either word stands in its place; one the vocabulary does not know is a substitution. */
const SLASH_ALT_NAME_RE = /([\p{L}'-]+)\/([\p{L}'-]+)/u;

/** `phrase` replaces the written name when an alternative was dropped; `sideTerms` were peeled off either side of a split. */
type Resolved = { concept: string; also: ParsedIngredient['also']; phrase?: string; sideTerms?: PreparationTerm[] };

/** Resolve the name to a concept, splitting or peeling terms until every written word is accounted for. */
export function resolve(named: NameResult, measure: Pick<AmountResult, 'written' | 'unit' | 'sizeNote'>, raw: string, language: string, lookup: IngredientLookup): Resolution {
  let phrase = named.phrase;
  const shared = phrase.match(SHARED_NOUN_RE);
  // Qualifiers in notes or unknown names must never disappear through canonicalization.
  // "butter (vegan)": the qualifier is outside an animal name, so the name alone must not map to butter.
  const qualifierOutsideName = isQualifiedIngredient(raw) && !isQualifiedIngredient(phrase)
    && Object.keys(languagePacks).some((l) => findUnsafeRenderedTerms(phrase, l).length > 0);
  const legacy = `${measure.written}${named.uncut}`.trim();
  // "can white beans" names the canned product: a name with its container comes before the name alone.
  // Every tail of the dropped words is tried ("inch piece cinnamon", "piece cinnamon").
  const tails = measure.written.split(/(?<=\s)/).map((_, i, parts) => parts.slice(i).join(''));
  const asWritten = [...new Set(tails.flatMap((t) => [`${t}${named.uncut}`, `${t}${phrase}`]))].map((t) => lookupConcept(t.trim(), lookup)).find(Boolean)
    ?? (named.uncut !== phrase ? lookupConcept(named.uncut.trim(), lookup) : null);
  let concept = qualifierOutsideName ? null : isQualifiedIngredient(phrase)
    ? (measure.written ? asWritten : null) ?? lookupConcept(phrase, lookup) ?? asWritten
    : (measure.written ? asWritten : null) ?? lookupConcept(phrase, lookup) ?? asWritten ?? (shared && lookupConcept(canonicalName(`${shared[1]} ${shared[2]}`), lookup)) ?? lookupConcept(named.name, lookup);
  phrase = phrase.trim();
  let conceptExact = !!concept && (lookupConcept(phrase, lookup) === concept || asWritten === concept);
  const terms: PreparationTerm[] = [];
  let also: ParsedIngredient['also'] = null;
  if (!conceptExact && !qualifierOutsideName) {
    // "romano or ramiro pepper" shares its noun and is never split into two ingredients.
    const resolvePhrase = (text: string): Resolved | null => {
      const id = resolveName(text, lookup, language);
      if (id) return { concept: id, also: null };
      const split = splitIngredients(text, lookup, language);
      if (split || language !== 'en') return split;
      // "basil and/or mint".
      const andOr = text.replace(/\s*\band\s*\/\s*or\b\s*/gi, ' or ');
      if (andOr !== text) return splitIngredients(andOr, lookup, language);
      const slash = text.match(SLASH_ALT_NAME_RE);
      if (!slash) return null;
      const variant = (word: string) => `${text.slice(0, slash.index)}${word}${text.slice(slash.index! + slash[0].length)}`;
      const [a, b] = [variant(slash[1]!), variant(slash[2]!)];
      const [left, right] = [resolvePhrase(a), resolvePhrase(b)];
      if (left && right && left.concept !== right.concept && !left.also && !right.also)
        return { ...left, phrase: a, also: { concept: right.concept, name: canonicalName(b), joiner: 'or' as const } };
      return left ? { ...left, phrase: left.phrase ?? a } : right ? { ...right, phrase: right.phrase ?? b } : null;
    };
    const found = peelTerms(phrase, resolvePhrase, lookup, language) ?? (legacy !== phrase ? peelTerms(legacy, resolvePhrase, lookup, language) : null);
    if (found) {
      ({ concept, also } = found);
      if (found.phrase) phrase = found.phrase;
      terms.push(...[...found.terms, ...found.sideTerms ?? []].map((t): PreparationTerm => ({ ...t, inName: true })));
      conceptExact = true;
    }
  }
  terms.push(...noteTerms(named.preparation, lookup).filter((t) => !terms.some((other) => other.id === t.id)));
  const sizeDef = measure.unit ? unitDef(measure.unit) : undefined;
  const measuredSize = measure.sizeNote && (!sizeDef || sizeDef.dimension === 'other') ? parseSize(measure.sizeNote) : null;

  return { concept, conceptExact, phrase, terms, also, size: measuredSize };
}

/**
 * The concept a name refers to: as written, else without a plant qualifier ("vegan coconut yogurt") or with
 * one typo fixed ("worcestshire sauce"), but only when what is left is not an animal word in the line's
 * language, so a qualifier or typo never turns a plant product into an animal one.
 */
function resolveName(text: string, lookup: IngredientLookup, language: string): string | null {
  const exact = lookupConcept(text, lookup);
  if (exact) return exact;
  const safe = (name: string) => findUnsafeRenderedTerms(name, language).length === 0;
  const plain = text.replace(/^(?:vegan|plant[ -]based|dairy[ -]free|non[ -]?dairy)\s+/i, '').replace(/\s+(?:vegan[oaie]|vegetal[ei])$/i, '');
  if (plain !== text) return safe(plain) ? lookupConcept(plain, lookup) : null;
  const near = safe(text) ? nearName(text, lookup) : null;
  return near && safe(near) ? lookupConcept(near, lookup) : null;
}

/**
 * "finely chopped parsley", "salt and pepper to taste": peel known preparation terms off either end of the name
 * until what remains resolves to known ingredients, so no written word is lost.
 */
function peelTerms(phrase: string, resolve: (text: string) => Resolved | null, lookup: IngredientLookup, language = 'en'): (Resolved & { terms: PreparationTerm[] }) | null {
  let words = phrase.split(/\s+/).filter(Boolean);
  const lead: PreparationTerm[] = [];
  const trail: PreparationTerm[] = [];
  let branded = false;
  const take = (fromEnd: boolean) => {
    // "bob's red mill almond flour": a leading brand is dropped, not shown.
    const brand = fromEnd ? 0 : [4, 3, 2, 1].find((n) => n < words.length && lookupBrand(words.slice(0, n).join(' '), lookup));
    if (brand) {
      words = words.slice(brand);
      branded = true;
      return true;
    }
    // "unflavored and unsweetened milk": a connector between two leading terms goes with them.
    const skip = !fromEnd && lead.length && /^(?:and|&|or|,)$/i.test(words[0] ?? '') ? 1 : 0;
    for (let n = Math.min(5, words.length - 1 - skip); n > 0; n--) {
      const text = (fromEnd ? words.slice(-n) : words.slice(skip, skip + n)).join(' ');
      const id = lookupTerm(text, lookup);
      if (!id) continue;
      words = fromEnd ? words.slice(0, -n) : words.slice(skip + n);
      (fromEnd ? trail : lead).push({ id, text });
      return true;
    }
    return false;
  };
  let resolved = resolve(words.join(' '));
  while (!resolved && (take(false) || take(true))) resolved = resolve(words.join(' '));
  // A brand may be what made the name plant-based ("violife cheddar"): never resolve to an animal name without it.
  if (resolved && branded && findUnsafeRenderedTerms(words.join(' '), language).length) return null;
  return resolved ? { ...resolved, terms: [...lead, ...trail.reverse()] } : null;
}


/**
 * "salt and ground pepper", "salt + pepper": two ingredients when both sides are known.
 * "walnuts or almonds", "cornflour / cornstarch": an alternative stays only when it names a known ingredient;
 * otherwise it is a substitution, which is commentary.
 */
function splitIngredients(phrase: string, lookup: IngredientLookup, language: string): Resolved | null {
  const pack: LanguagePack = languagePacks[language]!;
  const m = phrase.match(new RegExp(`^(.+?)\\s+(${pack.and}|&|\\+|${pack.or}|\\/)\\s+(.+)$`, 'i'));
  if (!m) return null;
  const side = (text: string) => {
    const id = lookupConcept(text, lookup);
    if (id) return { concept: id, terms: [] as PreparationTerm[] };
    const peeled = peelTerms(text, (t) => { const c = lookupConcept(t, lookup); return c ? { concept: c, also: null } : null; }, lookup);
    return peeled ? { concept: peeled.concept, terms: peeled.terms } : null;
  };
  const joiner = [pack.or, '/'].includes(m[2]!.toLowerCase()) ? 'or' : 'and';
  const right = side(m[3]!);
  // "firm or extra firm tofu", "lemon or lime juice", "romano or ramiro pepper": the first option shares
  // the second's noun, which is tried before the first option alone.
  const tail = m[3]!.split(/\s+/);
  const shared = [1, 2].map((k) => tail.length > k ? lookupConcept(`${m[1]} ${tail.slice(-k).join(' ')}`, lookup) : null).find(Boolean);
  const left = shared ? { concept: shared, terms: [] as PreparationTerm[] } : side(m[1]!);
  // "tamari or soy sauce": an alternative vegdex knows stands in for one it does not.
  if (!left) return joiner === 'or' && right ? { concept: right.concept, also: null, phrase: m[3]!.trim(), sideTerms: right.terms } : null;
  if (!right || right.concept === left.concept) return joiner === 'or' ? { concept: left.concept, also: null, phrase: m[1]!.trim(), sideTerms: left.terms } : null;
  const name = language === 'en' ? canonicalName(m[3]!) : m[3]!.trim().toLowerCase();
  const sideTerms = [...left.terms, ...right.terms].filter((t, i, all) => all.findIndex((o) => o.id === t.id) === i);
  return { concept: left.concept, also: { concept: right.concept, name, joiner }, sideTerms };
}

/** "15-ounce", "3-inch", "400 g": the size of one can or piece; null for anything else. */
function parseSize(text: string): ParsedIngredient['size'] {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*-?\s*([a-z]+\.?|"|”)$/i);
  const def = m ? lookupUnit(m[2] === '”' ? '"' : m[2]!) : undefined;
  return def && (def.dimension === 'mass' || def.dimension === 'volume' || def.unit === 'inch') ? { quantity: parseNumber(m![1]!), unit: def.unit } : null;
}

/** Each comma or bracket segment of a note that is a known preparation term; the rest is commentary. */
function noteTerms(note: string, lookup: IngredientLookup): PreparationTerm[] {
  const terms: PreparationTerm[] = [];
  // "(or parsley, chopped)": what follows an alternative inside its bracket describes the alternative.
  let depth = 0;
  let skipFrom: number | null = null;
  for (const token of note.match(/[()]|[^()]+/g) ?? []) {
    if (token === '(') { depth++; continue; }
    if (token === ')') { depth--; if (skipFrom !== null && depth < skipFrom) skipFrom = null; continue; }
    for (const segment of token.split(/[,;]|\s[-–—]\s/)) {
      const text = segment.trim().replace(/[.:]+$/, '');
      if (/^(?:or|o|oppure)\s/i.test(text)) skipFrom ??= depth;
      if (skipFrom !== null) continue;
      const id = text && lookupTerm(text, lookup);
      if (id && !terms.some((t) => t.id === id)) terms.push({ id, text });
    }
  }
  return terms;
}
