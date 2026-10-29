import { ingredientKey, lookupConcept, type IngredientLookup } from './concepts';

/**
 * Names one typo away from a known name: a letter missing, doubled or extra, or two neighbours swapped
 * ("worcestshire", "bouilon"). Substitutions are not typos here, since they turn one food into another
 * ("rice malt" is not "rice salt"). Spaces are never edited, and only names of six letters or more qualify.
 */
const indexes = new WeakMap<IngredientLookup, Map<string, string[]>>();

/** Every known name with one letter removed, for names a query lacks a letter of. */
function deletions(lookup: IngredientLookup): Map<string, string[]> {
  let index = indexes.get(lookup);
  if (index) return index;
  index = new Map();
  for (const key of Object.keys(lookup)) {
    if (key.length < 7 || !lookupConcept(key, lookup)) continue;
    for (const variant of edits(key, 'delete')) (index.get(variant) ?? index.set(variant, []).get(variant)!).push(key);
  }
  indexes.set(lookup, index);
  return index;
}

function* edits(text: string, kind: 'delete' | 'swap'): Generator<string> {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' || (kind === 'swap' && (i + 1 >= text.length || text[i + 1] === ' ' || text[i] === text[i + 1]))) continue;
    yield kind === 'delete' ? text.slice(0, i) + text.slice(i + 1) : text.slice(0, i) + text[i + 1] + text[i] + text.slice(i + 2);
  }
}

/** The one known name the text is a typo of, or null when none or several fit. */
export function nearName(text: string, lookup: IngredientLookup): string | null {
  const query = ingredientKey(text);
  if (query.length < 6 || /[^\p{L}' -]/u.test(query)) return null;
  const found = new Set<string>();
  for (const variant of edits(query, 'delete')) if (lookupConcept(variant, lookup)) found.add(variant);
  for (const variant of edits(query, 'swap')) if (lookupConcept(variant, lookup)) found.add(variant);
  for (const key of deletions(lookup).get(query) ?? []) found.add(key);
  const ids = new Set([...found].map((key) => lookupConcept(key, lookup)));
  return ids.size === 1 ? [...found][0]! : null;
}
