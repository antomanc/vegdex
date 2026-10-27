/** A recipe as stored by the ingest pipeline. Only facts: no instructions prose. */
export interface Recipe {
  id: string;
  title: string;
  sourceId: string;
  url: string;
  image: string | null;
  /** Total time in minutes, or null when the publisher gives none. */
  minutes: number | null;
  servings: number | null;
  rating: number | null;
  ratingCount: number | null;
  calories: number | null;
  protein: number | null;
  published: string | null;
  categories: string[];
  cuisines: string[];
  keywords: string[];
  /** Ingredient lines as published, entity-decoded. */
  ingredients: string[];
  tags: Tag[];
}

export const MEALS = [
  'breakfast',
  'main',
  'soup',
  'salad',
  'side',
  'snack',
  'dessert',
  'baking',
  'drink',
  'sauce'
] as const;
export type Meal = (typeof MEALS)[number];

export const FLAVORS = ['sweet', 'savory'] as const;
export type Flavor = (typeof FLAVORS)[number];

export const FREE_FROM = ['gluten-free', 'nut-free', 'soy-free', 'oil-free'] as const;
export type FreeFrom = (typeof FREE_FROM)[number];

export type Tag =
  | `meal:${Meal}`
  | `flavor:${Flavor}`
  | `free:${FreeFrom}`
  | 'high-protein'
  | `cuisine:${string}`;

export interface Source {
  id: string;
  name: string;
  url: string;
}

/** One row of the published catalog: everything the grid and filters need. */
export interface CatalogRecipe {
  id: string;
  title: string;
  source: string;
  url: string;
  image: string | null;
  minutes: number | null;
  servings: number | null;
  rating: number | null;
  ratingCount: number | null;
  calories: number | null;
  protein: number | null;
  published: string | null;
  tags: Tag[];
  /** Canonical ingredient names, for include/exclude filters. */
  ing: string[];
}

export interface Catalog {
  version: 1;
  generatedAt: string;
  sources: Source[];
  recipes: CatalogRecipe[];
}

/** Full records (catalog row + raw ingredient lines), used by the MCP server. */
export interface FullRecipe extends CatalogRecipe {
  ingredients: string[];
}

export interface FullDataset {
  version: 1;
  generatedAt: string;
  sources: Source[];
  recipes: FullRecipe[];
}
