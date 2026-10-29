import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { ingredientKey, singularize, type ConceptVeganStatus } from '@vegdex/core';

const dir = new URL('../data/', import.meta.url);
const input = fs.readFileSync(new URL('ingredients.off.txt', dir));
const sha256 = createHash('sha256').update(input).digest('hex');
if (sha256 !== '182d0c76ddce19d79c773ef30792eff36c3fab7cd647a0bf7c97aca674822812') throw new Error('Pinned OFF taxonomy checksum mismatch');
const provenance = {
  publisher: 'Open Food Facts contributors',
  source: 'https://github.com/openfoodfacts/openfoodfacts-server/blob/2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae/taxonomies/food/ingredients.txt',
  revision: '2e0fbc728d71ba8d0a8d40b8c6858716f0e803ae', sha256,
  license: 'https://opendatacommons.org/licenses/odbl/1-0/',
  contentsLicense: 'https://opendatacommons.org/licenses/dbcl/1-0/'
};
type Concept = { id: string; names: { en: string[]; it: string[] }; parents: string[]; vegan: ConceptVeganStatus };
const entries: { concept: Concept; parents: string[] }[] = [];
for (const block of input.toString('utf8').split(/\n\s*\n/)) {
  const names = { en: [] as string[], it: [] as string[] };
  const parents: string[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^(en|it):\s*(.+)/);
    if (m) names[m[1] as 'en' | 'it'].push(...m[2]!.split(',').map(ingredientKey).filter(Boolean));
    const parent = line.match(/^<\s*en:\s*(.+)/);
    if (parent) parents.push(ingredientKey(parent[1]!));
  }
  if (!names.en.length) continue;
  // Frozen source identity: retain this ID explicitly if a later taxonomy renames the entry.
  const id = `off:${createHash('sha256').update(names.en[0]!).digest('hex').slice(0, 16)}`;
  const vegan = block.match(/^vegan:en:\s*(yes|no|maybe)\s*$/m)?.[1] as ConceptVeganStatus | undefined;
  entries.push({ concept: { id, names, parents: [], vegan: vegan ?? 'unknown' }, parents });
}
const byName = new Map(entries.flatMap(({ concept }) => concept.names.en.map((n) => [n, concept.id] as const)));
for (const { concept, parents } of entries) concept.parents = parents.flatMap((p) => byName.has(p) ? [byName.get(p)!] : []);
const additions: Concept[] = JSON.parse(fs.readFileSync(new URL('additions.json', dir), 'utf8'));
const concepts = entries.map((e) => e.concept);
for (const addition of additions) {
  const existing = concepts.find((c) => c.id === addition.id);
  if (existing) {
    for (const lang of ['en', 'it'] as const) existing.names[lang].push(...addition.names[lang]);
    if (addition.vegan) existing.vegan = addition.vegan;
  } else concepts.push(addition);
}
// Explicit statuses win; otherwise inherit taxonomy evidence, with animal ancestry taking priority.
const inherited = concepts.filter((c) => c.vegan === 'unknown');
const byId = new Map(concepts.map((c) => [c.id, c]));
let changed: boolean;
do {
  changed = false;
  for (const c of inherited) {
    const parents = c.parents.map((id) => byId.get(id)?.vegan);
    const vegan = (['no', 'maybe', 'yes'] as const).find((s) => parents.includes(s)) ?? 'unknown';
    if (c.vegan !== vegan) { c.vegan = vegan; changed = true; }
  }
} while (changed);
// Ambiguous aliases are omitted, never resolved by file order. English plurals are exact aliases too.
for (const c of concepts) {
  c.names.en = [...new Set(c.names.en.flatMap((n) => {
    const words = n.split(' ');
    words[words.length - 1] = singularize(words.at(-1)!);
    return [n, words.join(' ')];
  }))].sort();
  c.names.it = [...new Set(c.names.it)].sort();
}
const ambiguous: Record<string, string[]> = {};
for (const lang of ['en', 'it'] as const) {
  const owners = new Map<string, Set<string>>();
  for (const c of concepts) for (const n of c.names[lang]) {
    if (!owners.has(n)) owners.set(n, new Set());
    owners.get(n)!.add(c.id);
  }
  ambiguous[lang] = [...owners].filter(([, ids]) => ids.size > 1).map(([n]) => n).sort();
  for (const c of concepts) c.names[lang] = c.names[lang].filter((n) => owners.get(n)!.size === 1);
}
concepts.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(new URL('concepts.json', dir), JSON.stringify({ provenance, concepts }, null, 1) + '\n');
fs.writeFileSync(new URL('ambiguous.json', dir), JSON.stringify(ambiguous, null, 1) + '\n');
console.log(`Seeded ${concepts.length} concepts; omitted ambiguous aliases: en=${ambiguous.en!.length}, it=${ambiguous.it!.length}`);
