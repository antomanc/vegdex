import type { LanguagePack } from '../languages';
import { lookupConcept, type IngredientLookup } from '../concepts';
import { canonicalName } from './names';
import { TRAILING_EXTRA_RE, ALT_SIZE_RE, ALT_AMOUNT_RE } from './measure';
import { onlyTerms } from './resolve';
import type { ParseState } from './types';

/** "plain, unsweetened non-dairy milk", "medium (113g) onion": words that only describe continue with the name. */
const NAME_HEAD_RE = /^([^,;(]+?)\s*(?:,\s*|\(([^()]*)\)\s*)(?=[\p{L}])/u;

/** Split the remaining text into name and notes, and canonicalise the name. */
export function nameAndNotes(state: ParseState, language: string, pack: LanguagePack, lookup: IngredientLookup): void {
  let s = state.text;
  // "water + 2 tablespoons": an extra amount of the same ingredient goes to the notes.
  if (language === 'en') s = s.replace(TRAILING_EXTRA_RE, (m) => `, ${m.replace(/^\s*(?:\+|plus)\s*/i, '')}`);
  const head = s.match(NAME_HEAD_RE);
  if (head && onlyTerms(head[1]!, lookup) && !lookupConcept(head[1]!, lookup)) s = `${head[1]} ${s.slice(head[0].length)}${head[2] ? ` (${head[2]})` : ''}`;
  const commaAt = s.search(/[,;(]/);
  const afterName = commaAt >= 0 ? s.slice(commaAt) : '';
  let note = [state.sizeNote, state.cutNote, afterName].filter(Boolean).join(' ').replace(/^[,;\s]+/, '');
  // "seeds of choice", "toppings such as tomato": the choice is commentary.
  let phrase = s.split(/[,;(]/)[0]!.trim().replace(/\s+(?:of (?:your )?choice|such as\b.*)$/i, '').replace(/^(?:your\s+)?favou?rite\s+/i, '');
  // "4 small or 3 large bananas", "buns or 8 slices of bread": the amount of an alternative is dropped with it.
  // An alternative with an amount of its own is commentary: shown under the first amount, it would be wrong.
  const uncut = phrase;
  if (language === 'en') phrase = phrase.replace(ALT_SIZE_RE, '$1 ').replace(ALT_AMOUNT_RE, '');
  let preparation = [afterName, ...state.leading].join(', ');
  const trailing = !lookupConcept(phrase, lookup) && pack.trailingNote ? phrase.match(pack.trailingNote) : null;
  if (trailing) {
    phrase = phrase.slice(0, trailing.index);
    note = [trailing[1], note].filter(Boolean).join(', ');
    preparation = [trailing[1], preparation].filter(Boolean).join(', ');
  }
  state.phrase = phrase;
  state.uncut = uncut;
  state.note = note;
  state.preparation = preparation;
  state.name = pack.nonIngredient?.test(s) ? '' : language === 'en' ? canonicalName(s) : phrase.trim().toLowerCase();
}
