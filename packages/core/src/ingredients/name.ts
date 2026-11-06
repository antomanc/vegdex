import type { LanguagePack } from '../languages';
import { lookupConcept, lookupTerm, type IngredientLookup } from '../concepts';
import { canonicalName } from './names';
import { TRAILING_EXTRA_RE, ALT_SIZE_RE, ALT_AMOUNT_RE } from './measure';
import type { AmountResult } from './amount';

export interface NameResult {
  phrase: string;
  // Resolution retries the phrase before amount-bearing alternatives were removed, for compatibility.
  uncut: string;
  note: string; preparation: string; name: string;
}

/** "plain, unsweetened non-dairy milk", "medium (113g) onion": words that only describe continue with the name. */
const NAME_HEAD_RE = /^([^,;(]+?)\s*(?:,\s*|\(([^()]*)\)\s*)(?=[\p{L}])/u;

/** Split the remaining text into name and notes, and canonicalise the name. */
export function nameAndNotes(input: Pick<AmountResult, 'text' | 'sizeNote' | 'cutNote' | 'leading'>, language: string, pack: LanguagePack, lookup: IngredientLookup): NameResult {
  let s = input.text;
  // "water + 2 tablespoons": an extra amount of the same ingredient goes to the notes.
  if (language === 'en') s = s.replace(TRAILING_EXTRA_RE, (m) => `, ${m.replace(/^\s*(?:\+|plus)\s*/i, '')}`);
  const head = s.match(NAME_HEAD_RE);
  if (head && onlyTerms(head[1]!, lookup) && !lookupConcept(head[1]!, lookup)) s = `${head[1]} ${s.slice(head[0].length)}${head[2] ? ` (${head[2]})` : ''}`;
  const commaAt = s.search(/[,;(]/);
  const afterName = commaAt >= 0 ? s.slice(commaAt) : '';
  let note = [input.sizeNote, input.cutNote, afterName].filter(Boolean).join(' ').replace(/^[,;\s]+/, '');
  // "seeds of choice", "toppings such as tomato": the choice is commentary.
  let phrase = s.split(/[,;(]/)[0]!.trim().replace(/\s+(?:of (?:your )?choice|such as\b.*)$/i, '').replace(/^(?:your\s+)?favou?rite\s+/i, '');
  // "4 small or 3 large bananas", "buns or 8 slices of bread": the amount of an alternative is dropped with it.
  // An alternative with an amount of its own is commentary: shown under the first amount, it would be wrong.
  const uncut = phrase;
  if (language === 'en') phrase = phrase.replace(ALT_SIZE_RE, '$1 ').replace(ALT_AMOUNT_RE, '');
  let preparation = [afterName, ...input.leading].join(', ');
  const trailing = !lookupConcept(phrase, lookup) && pack.trailingNote ? phrase.match(pack.trailingNote) : null;
  if (trailing) {
    phrase = phrase.slice(0, trailing.index);
    note = [trailing[1], note].filter(Boolean).join(', ');
    preparation = [trailing[1], preparation].filter(Boolean).join(', ');
  }
  const name = pack.nonIngredient?.test(s) ? '' : language === 'en' ? canonicalName(s) : phrase.trim().toLowerCase();
  return { phrase, uncut, note, preparation, name };
}

/** Whether the words are all preparation terms ("plain", "unsweetened, plain"). */
function onlyTerms(text: string, lookup: IngredientLookup): boolean {
  let words = text.toLowerCase().split(/[\s,]+/).filter(Boolean);
  while (words.length) {
    const n = [3, 2, 1].find((k) => k <= words.length && lookupTerm(words.slice(0, k).join(' '), lookup));
    if (!n) return false;
    words = words.slice(n);
  }
  return true;
}

