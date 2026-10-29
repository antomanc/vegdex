import fs from 'node:fs';
import type { ConceptVeganStatus } from '@vegdex/core';

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
