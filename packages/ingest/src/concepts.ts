import fs from 'node:fs';
import type { ConceptVeganStatus, IngredientLookup } from '@vegdex/core';

export interface Concept {
  id: string;
  names: Record<string, string[]>;
  parents: string[];
  vegan: ConceptVeganStatus;
}
export const seed = JSON.parse(fs.readFileSync(new URL('../data/concepts.json', import.meta.url), 'utf8')) as {
  provenance: Record<string, string>;
  concepts: Concept[];
};
const byId = new Map(seed.concepts.map((c) => [c.id, c]));

/** Include exact taxonomy ancestors so a mushroom filter also finds named mushroom varieties. */
export function conceptFamily(ids: string[], concepts = byId): string[] {
  const found = new Set(ids);
  for (const id of found) for (const parent of concepts.get(id)?.parents ?? []) found.add(parent);
  return [...found].sort();
}

export function usedLookup(language: string, used?: Set<string>, concepts = seed.concepts): IngredientLookup {
  const aliases: IngredientLookup = Object.create(null);
  const ambiguous = new Set<string>();
  for (const c of concepts) {
    if (used && !used.has(c.id)) continue;
    for (const n of language === 'en' ? c.names.en ?? [] : [...(c.names.en ?? []), ...(c.names[language] ?? [])]) {
      if (aliases[n] && aliases[n] !== c.id) ambiguous.add(n);
      else aliases[n] = c.id;
    }
  }
  for (const n of ambiguous) delete aliases[n];
  return aliases;
}
export const englishLookup = usedLookup('en');
export const conceptVegan = Object.fromEntries(seed.concepts.map((c) => [c.id, c.vegan]));
