import { isTermId } from './vocabulary';

/** Exact language aliases → stable, language-neutral concepts and preparation terms. No dictionary is bundled here. */
export type IngredientLookup = Record<string, string>;

export function isQualifiedIngredient(name: string): boolean {
  return /\b(?:vegan[oaie]?|vegetarian[oaie]?|vegetal[ei]|senza\s+(?:latte|latticini|carne)|plant[ -]based|plant|non[ -]?dairy|dairy[ -]free|meat[ -]free|meatless)\b/i.test(name.replace(/\p{Pd}/gu, '-'));
}

export function ingredientKey(name: string): string {
  return name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
}

function lookupEntry(name: string, lookup: IngredientLookup): string | null {
  const key = ingredientKey(name);
  return Object.hasOwn(lookup, key) ? lookup[key]! : null;
}

export function lookupConcept(name: string, lookup: IngredientLookup = {}): string | null {
  const id = lookupEntry(name, lookup);
  return id && !isTermId(id) ? id : null;
}

export function lookupTerm(text: string, lookup: IngredientLookup = {}): string | null {
  const id = lookupEntry(text, lookup);
  return id && isTermId(id) ? id : null;
}
