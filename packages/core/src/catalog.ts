import type { Catalog, CatalogRecipe, Tag } from './types';

/**
 * catalog.json as shipped: strings repeated across recipes (concepts, ingredient names, tags) are stored once
 * and referenced by position, and a recipe lists only the concepts that its others do not already imply.
 * Read it with unpackCatalog, which gives back the Catalog it was packed from.
 */
export interface PackedCatalog extends Omit<Catalog, 'version' | 'recipes'> {
  version: 2;
  concepts: string[];
  /** The positions of each concept's parents. */
  parents: number[][];
  names: string[];
  tags: Tag[];
  recipes: PackedRecipe[];
}

export type PackedRecipe = Omit<CatalogRecipe, 'concepts' | 'ing' | 'tags'> & {
  /** The concepts not implied by others; unpacking adds their ancestors. */
  concepts?: number[];
  /** A concept list that leaves out an ancestor of its own concepts, kept exactly as given. */
  conceptsAsIs?: number[];
  ing: number[];
  tags: number[];
};

const table = <T extends string>(values: Iterable<T>) => {
  const list = [...new Set(values)].sort();
  return { list, at: new Map(list.map((v, i) => [v, i])) };
};

/** Every concept a set implies through its parents, as sorted positions. */
function closure(start: Iterable<number>, parents: number[][]): number[] {
  const found = new Set(start);
  for (const id of found) for (const parent of parents[id] ?? []) found.add(parent);
  return [...found].sort((a, b) => a - b);
}

export function packCatalog(catalog: Catalog, parentsOf: (concept: string) => readonly string[]): PackedCatalog {
  const { recipes, version: _, ...rest } = catalog;
  const concepts = table(recipes.flatMap((r) => r.concepts ?? []));
  const names = table(recipes.flatMap((r) => r.ing));
  const tags = table(recipes.flatMap((r) => r.tags));
  const parents = concepts.list.map((id) => parentsOf(id).flatMap((p) => (concepts.at.has(p) ? [concepts.at.get(p)!] : [])));
  // A concept that another one in the recipe implies is left out; unpacking finds it again.
  const ancestors = concepts.list.map((_, i) => new Set(closure(parents[i]!, parents)));
  const direct = (family: number[]): number[] => {
    const kept = family.filter((id) => !family.some((other) => other !== id && ancestors[other]!.has(id)));
    // Concepts that are each other's ancestors would all drop out; then the family ships whole.
    return closure(kept, parents).join() === family.join() ? kept : family;
  };
  return {
    version: 2,
    ...rest,
    concepts: concepts.list,
    parents,
    names: names.list,
    tags: tags.list,
    recipes: recipes.map(({ concepts: own, ing, tags: tagged, ...row }) => {
      const given = own?.map((id) => concepts.at.get(id)!).sort((a, b) => a - b);
      const closed = given && closure(given, parents).join() === given.join();
      return {
        ...row,
        ...(given ? (closed ? { concepts: direct(given) } : { conceptsAsIs: given }) : {}),
        ing: ing.map((name) => names.at.get(name)!),
        tags: tagged.map((tag) => tags.at.get(tag)!)
      };
    })
  };
}

/** The catalog as the app and search read it; a catalog from before packing passes through unchanged. */
export function unpackCatalog(catalog: Catalog | PackedCatalog): Catalog {
  if (catalog.version !== 2) return catalog;
  const { recipes, concepts, parents, names, tags, version: _, ...rest } = catalog;
  const families = new Map<string, string[]>();
  return {
    version: 1,
    ...rest,
    recipes: recipes.map(({ concepts: own, conceptsAsIs, ing, tags: tagged, ...row }) => {
      let family = conceptsAsIs?.map((id) => concepts[id]!);
      if (own) {
        const key = own.join();
        family = families.get(key);
        if (!family) families.set(key, (family = closure(own, parents).map((id) => concepts[id]!)));
      }
      return { ...row, ...(family ? { concepts: family } : {}), ing: ing.map((i) => names[i]!), tags: tagged.map((i) => tags[i]!) };
    })
  };
}
