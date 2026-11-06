import { cleanText } from '../text';
import type { LanguagePack } from '../languages';
import { stripMeasureWords } from './measure';
export interface Normalised { text: string; optional: boolean; approx: boolean; leading: string[] }

const VULGAR: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5',
  '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
};

/** Preparation written before the line ("Juice of 1 lemon", "Optional: …", "more hot sauce") moves to its notes. */
const LEADING_NOTE_RE = /^(?:(juice|zest)(?:\s+and\s+(juice|zest))?\s+(?:of|from)\s+(?:the\s+)?|\(?(optional)\)?[:\s]\s*|(more|additional)\s+)/i;
/** "(2) cans": a numbered list marker is not an amount. */
const LIST_NUMBER_RE = /^\((\d+)\)\s*/;

/** Normalize unicode fractions and stray punctuation so the regexes see plain text. */
export function normalizeLine(raw: string): string {
  let s = cleanText(raw);
  s = s.replace(/(\d)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, d: string, f: string) => `${d} ${VULGAR[f]}`);
  s = s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (f) => VULGAR[f] ?? f);
  s = s.replace(/⁄/g, '/');
  // "3 /4 teaspoon": a fraction split by a stray space.
  s = s.replace(/(\d) \/(\d)/g, '$1/$2');
  // "14- oz . can", "1 12-ounce) bag": a stray space or a missing bracket in the measure.
  s = s.replace(/\b(oz|lbs?|tsp|tbsp|c)\s+\.(?=\s)/gi, '$1.').replace(/^(\d+) (\d[\d.]*\s*-?\s*(?:ounces?|oz|grams?|g|ml|lbs?|pounds?)\.?)\)/i, '$1 ($2)');
  s = s.replace(/\(\(/g, '(').replace(/\)\)/g, ')');
  s = s.replace(/\*+/g, '');
  // Invisible separators, inch marks ("1/2” ginger"), a lone "|" and a full stop after the name ("baking powder.").
  s = s.replace(/[\u200b-\u200d\u2060-\u2064\u2800\ufeff]/g, '').replace(/^([\d\s\/.–-]*\d)\s*[”″](?=\s*\p{L})/u, '$1 inch ');
  s = s.replace(/(\d\/\d+)\.(?=\s)/g, '$1').replace(/\s\|(?=\s|$)/g, ' ').replace(/(\p{L}{3})\.(?=\s*(?:\(|$))/gu, '$1');
  s = s.replace(/^[-•▢·\s]+/, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalise the raw line: fix unicode and punctuation, detect the optional flag, and move leading notes
 * ("Juice of 1 lemon", "Optional: …") and language shapes ("il succo di mezzo limone") out of the text.
 */
export function normalise(raw: string, language: string, pack: LanguagePack): Normalised {
  let text = normalizeLine(raw).replace(/^\.(?=\d)/, '0.');
  const optional = (pack.optional ?? /\boptional\b/i).test(text);
  let approx = false;
  const leading: string[] = [];

  const lead = text.match(LEADING_NOTE_RE);
  if (lead && language === 'en') {
    text = text.slice(lead[0].length);
    if (lead[1]) leading.push(...[lead[1], lead[2]].filter(Boolean).map((w) => (w!.toLowerCase() === 'juice' ? 'juiced' : 'zested')));
    else leading.push(lead[3] ? 'optional' : 'as needed');
  }
  if (pack.shapes) text = pack.shapes(text, leading);
  text = text.replace(LIST_NUMBER_RE, '$1 ');
  const stripped = stripMeasureWords(text, pack);
  text = stripped.text;
  approx ||= stripped.approx;
  return { text, optional, approx, leading };
}
