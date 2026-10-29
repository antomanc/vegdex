/**
 * Display vocabulary for one UI language. Concepts and preparation terms are language-neutral IDs;
 * a language supplies their names with the grammatical forms the renderer needs.
 */
export type Gender = 'm' | 'f' | 'n';

/** "cipolla"/"cipolle", feminine. Mass nouns repeat the singular: "olio"/"olio". */
export interface NounForms {
  one: string;
  other: string;
  gender?: Gender;
}

/** A plain string in languages without gender; otherwise one form per gender and number ("m", "f.pl"). */
export type TermForms = string | Partial<Record<Gender | `${Gender}.pl`, string>>;

export interface LanguageVocabulary {
  language: string;
  /** Concept ID → name forms. */
  names: Record<string, NounForms>;
  /** Preparation term ID → forms. */
  terms: Record<string, TermForms>;
  /** Unit → [singular, plural] labels. */
  units: Record<string, [singular: string, plural: string]>;
  /** Original title → translation. */
  titles: Record<string, string>;
}

/** Preparation terms share the alias space with concepts and are told apart by this prefix. */
export const TERM_PREFIX = 'term:';
export const isTermId = (id: string) => id.startsWith(TERM_PREFIX);

/** Counts of one or less take the singular; everything else, measured amounts included, the plural form. */
export function nounForm(forms: NounForms, quantity: number | null, measured: boolean): { text: string; plural: boolean } {
  const one = !measured && quantity !== null && quantity <= 1;
  return one ? { text: forms.one, plural: false } : { text: forms.other, plural: forms.other !== forms.one };
}

export function termForm(forms: TermForms, gender: Gender | undefined, plural: boolean): string | undefined {
  if (typeof forms === 'string') return forms;
  if (!gender) return undefined;
  return forms[plural ? (`${gender}.pl` as const) : gender];
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞']
];

/** Kitchen amounts: "½", "1 ½", "⅓", and locale decimals ("1,25") only where no common fraction fits. */
export function formatAmount(n: number, language: string): string {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  if (rest < 1e-6) return String(whole);
  const fraction = FRACTIONS.find(([value]) => Math.abs(rest - value) < 0.01)?.[1];
  if (fraction) return whole ? `${whole} ${fraction}` : fraction;
  return new Intl.NumberFormat(language, { useGrouping: false, maximumFractionDigits: 2 }).format(n);
}

export function formatAmountRange(quantity: number, quantityMax: number | null, language: string): string {
  const low = formatAmount(quantity, language);
  return quantityMax === null ? low : `${low}–${formatAmount(quantityMax, language)}`;
}
