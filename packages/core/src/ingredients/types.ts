export type Dimension = 'volume' | 'mass' | 'count' | 'other';

export interface UnitDef {
  unit: string;
  dimension: Dimension;
  /** Size in ml (volume) or g (mass); 1 for count/other. */
  factor: number;
}

export interface PreparationTerm {
  id: string;
  /** The words as written. */
  text: string;
  /** Written inside the name ("chopped scallion"), not in a note: other languages attach it to the noun. */
  inName?: true;
}

export interface ParsedIngredient {
  /** English name of a mapped concept, used only with the existing density table. */
  densityName?: string;
  /** False when mapping discarded source wording that display must retain. Absent in older datasets. */
  conceptExact?: boolean;
  /** The ingredient as written, without amount, notes or commentary. Absent in older datasets. */
  phrase?: string;
  /** Preparation terms in line order. Notes that are not terms are commentary and never displayed. */
  terms?: PreparationTerm[];
  /** "1 (15 oz) can": the size of each can, block or piece. */
  size?: { quantity: number; unit: string } | null;
  /** "salt and pepper", "walnuts or almonds": the second ingredient, when both sides are known exactly. */
  also?: { concept: string; name: string; joiner: 'and' | 'or' } | null;
  /** "about 2 cups". */
  approx?: true;
  /** Not an ingredient: a heading ("For the sauce:") or anything else (equipment, instructions, notes). */
  kind?: 'heading' | 'other';
  concept: string | null;
  raw: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** Metric weight or volume from a parenthetical like "(240 g)" or a dual measure like "1 cup / 240 ml". */
  metric: { quantity: number; unit: 'g' | 'ml' } | null;
  /** When the line has a unit: the text after its amount, unit and any metric equivalent ("flour, sifted"). */
  afterMeasure: string | null;
  /** Canonical, singular, lowercase name used for matching and aggregation. */
  name: string;
  note: string;
  optional: boolean;
}

/** A raw line as shipped: one ingredient, or its parts when the line names several with their own amounts. */
export type ParsedLine = ParsedIngredient | ParsedIngredient[];

/** The state threaded through the parse stages: each stage reads and writes the fields it owns. */
export interface ParseState {
  /** The remaining text to parse; stages consume it from the front. */
  text: string;
  optional: boolean;
  approx: boolean;
  /** Words an older parser left in the name but this one reads as amount or commentary ("can", "inch piece"). */
  written: string;
  /** Preparation notes moved before the line ("juiced", "to taste"). */
  leading: string[];
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** "15-ounce", "3-inch", "400 g": the size of one can, block or piece. */
  sizeNote: string;
  /** The size of the cut ("1/4 inch") written with the amount, kept as a note. */
  cutNote: string;
  metric: ParsedIngredient['metric'];
  afterMeasure: string | null;
  phrase: string;
  /** The phrase before alternatives with their own amount were dropped from it. */
  uncut: string;
  note: string;
  preparation: string;
  name: string;
  concept: string | null;
  conceptExact: boolean;
  terms: PreparationTerm[];
  also: ParsedIngredient['also'];
  size: ParsedIngredient['size'];
}

export function newParseState(): ParseState {
  return {
    text: '',
    optional: false,
    approx: false,
    written: '',
    leading: [],
    quantity: null,
    quantityMax: null,
    unit: null,
    sizeNote: '',
    cutNote: '',
    metric: null,
    afterMeasure: null,
    phrase: '',
    uncut: '',
    note: '',
    preparation: '',
    name: '',
    concept: null,
    conceptExact: false,
    terms: [],
    also: null,
    size: null
  };
}
