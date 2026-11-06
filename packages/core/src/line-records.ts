import { termForm, nounForm, type LanguageVocabulary } from './vocabulary';
import { lookupConcept, type IngredientLookup } from './concepts';
import { parseIngredient, type ParsedIngredient } from './ingredients';
import { findUnsafeRenderedTerms } from './translations';
import { lookupUnit } from './ingredients/units';

export interface LineAmount {
  quantity?: number;
  quantityMax?: number;
  unit?: string;
}
export interface LineAlternative extends LineAmount { en: string; it: string }
export interface LinePart extends LineAlternative {
  plus?: LineAmount;
  preparationEn?: string;
  preparationIt?: string;
  purposeEn?: string;
  purposeIt?: string;
  optional?: boolean;
  toTaste?: boolean;
  alternatives?: LineAlternative[];
}
export interface LineRecord {
  line: string;
  language: string;
  kind?: 'heading' | 'other';
  parts?: LinePart[];
}
export interface LineRecordFile { model: string; schema: 1 }
export interface RecordFinding { code: string; severity: 'error' | 'review' }

export function lineKey(language: string, line: string): string {
  return language + '\0' + line.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

const fractions: Record<string, number> = { '½': .5, '¼': .25, '¾': .75, '⅓': 1/3, '⅔': 2/3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875, '⅕': .2, '⅖': .4, '⅗': .6, '⅘': .8, '⅙': 1/6, '⅚': 5/6 };
function numbers(text: string): number[] {
  text = text.replace(/(\d)?([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])/g, (_, whole, f: string) => ' ' + (Number(whole ?? 0) + fractions[f]!) + ' ');
  return [...text.matchAll(/\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?/g)].map(([n]) => {
    const mixed = n.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = n.split('/');
    return fraction.length === 2 ? Number(fraction[0]) / Number(fraction[1]) : Number(n.replace(',', '.'));
  });
}
const qualifiers = ['vegan', 'plant-based', 'dairy-free', 'non-dairy', 'fresh', 'dried', 'ground', 'smoked', 'frozen', 'canned', 'unsweetened', 'unsalted', 'low-sodium'];
const plant = /\b(?:vegan|plant[ -]based|dairy[ -]free|non[ -]?dairy|vegetale|vegano)\b/i;
// Count units explicitly permitted by the audit beyond the parser's conversion units.
const countUnits = new Set('batch recipe drop pod ear stick knob cube sprinkle splash packet squeeze drizzle loaf wedge bulb strand rib shot capsule strip spray dollop tube portion serving bean spear bar cob crown stem link tea bag glass bundle ball shake part square twist squirt pat bowl twig chunk tub dry pint gallon layer envelope grind mg tablet thumb quill vanilla bean spoon heart teabag star centimeter swirl pan segment sleeve thread ladle wheel glug spritz pouch'.split(' '));
const english = /\b(?:fresh|dried|ground|smoked|frozen|canned|unsweetened|unsalted|butter|flour|milk|chopped|sliced|peeled|serving|garnish|powder|pumpkin|purpose|flakes|shredded|cloves|tablespoon|teaspoon)\b/i;

/** Accept unknown input so malformed imported or hand-edited records fail closed. */
export function validateRecord(value: unknown): RecordFinding[] {
  const findings = new Map<string, RecordFinding>();
  const add = (code: string, severity: RecordFinding['severity']) => findings.set(code, { code, severity });
  const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0;
  if (!object(value) || !text(value.line) || !['en', 'it'].includes(String(value.language))) return [{ code: 'schema', severity: 'error' }];
  const r = value;
  const fields = (a: Record<string, unknown>, allowed: string) => {
    if (Object.keys(a).some(k => !allowed.split(' ').includes(k))) add('schema', 'error');
  };
  fields(r, 'line language kind parts');
  if (r.kind !== undefined) {
    if (!['heading', 'other'].includes(String(r.kind)) || r.parts !== undefined) add('kind', 'error');
    return [...findings.values()];
  }
  if (!Array.isArray(r.parts) || !r.parts.length) return [{ code: 'kind', severity: 'error' }];
  const sourceNumbers = numbers(String(r.line));
  const amount = (a: Record<string, unknown>) => {
    for (const key of ['quantity', 'quantityMax']) if (a[key] !== undefined) {
      const n = a[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) add('amount', 'error');
      else if (!sourceNumbers.some(s => Math.abs(s - n) < 1e-6)) add('number-not-in-line', 'review');
    }
    if (a.quantityMax !== undefined && !(typeof a.quantity === 'number' && Number(a.quantityMax) > a.quantity)) add('range', 'error');
    if (a.unit !== undefined && (typeof a.unit !== 'string' || (!lookupUnit(a.unit) && !countUnits.has(a.unit)))) add('unit', 'error');
  };
  const seen = new Set<string>();
  const preserved: string[] = [];
  for (const p of r.parts) {
    if (!object(p)) { add('schema', 'error'); continue; }
    fields(p, 'quantity quantityMax unit en it plus preparationEn preparationIt purposeEn purposeIt optional toTaste alternatives');
    const identity = String(p.en).trim().toLowerCase();
    if (seen.has(identity)) add('duplicate-part', 'error');
    seen.add(identity);
    for (const key of ['optional', 'toTaste']) if (p[key] !== undefined && typeof p[key] !== 'boolean') add('schema', 'error');
    for (const key of ['preparationEn', 'preparationIt', 'purposeEn', 'purposeIt']) if (p[key] !== undefined && !text(p[key])) add('schema', 'error');
    if (p.plus !== undefined) { if (object(p.plus)) { fields(p.plus, 'quantity quantityMax unit'); amount(p.plus); } else add('schema', 'error'); }
    if (p.alternatives !== undefined && !Array.isArray(p.alternatives)) add('schema', 'error');
    for (const a of [p, ...(Array.isArray(p.alternatives) ? p.alternatives : [])]) {
      if (!object(a)) { add('schema', 'error'); continue; }
      if (a !== p) fields(a, 'quantity quantityMax unit en it');
      amount(a);
      if (numbers(String(a.en) + ' ' + String(a.it)).some(n => !sourceNumbers.some(s => Math.abs(s - n) < 1e-6))) add('number-not-in-line', 'review');
      if (!text(a.en) || !text(a.it)) add('empty-name', 'error');
      for (const lang of ['en', 'it']) if (typeof a[lang] === 'string' && plant.test(String(r.line)) && findUnsafeRenderedTerms(String(a[lang]), lang).length) add('unsafe-name', 'review');
      if (english.test(String(a.it))) add('english-in-italian', 'review');
      preserved.push(String(a.en), String(a.it));
    }
    preserved.push(String(p.preparationEn ?? ''), String(p.preparationIt ?? ''));
    for (const key of ['preparationEn', 'preparationIt', 'purposeEn', 'purposeIt']) {
      if (numbers(String(p[key] ?? '')).some(n => !sourceNumbers.some(s => Math.abs(s - n) < 1e-6))) add('number-not-in-line', 'review');
    }
  }
  const all = preserved.join(' ').toLowerCase();
  for (const q of qualifiers) if (new RegExp('\\b' + q.replace('-', '[ -]') + '\\b', 'i').test(String(r.line)) && !new RegExp('\\b' + q.replace('-', '[ -]') + '\\b', 'i').test(all)) add('qualifier-lost', 'review');
  return [...findings.values()];
}

function exactConcept(name: string, lookup: IngredientLookup): string | null {
  const read = parseIngredient(name, lookup);
  return read.conceptExact === true ? read.concept : null;
}

/** Parser measurements survive unless the record changes the number of ingredients. */
export function applyLineRecord(parsed: ParsedIngredient[], record: LineRecord | undefined, lookup: IngredientLookup, displays: Record<string, LanguageVocabulary> = {}): ParsedIngredient[] {
  if (!record) return parsed;
  const first = parsed[0]!;
  if (record.kind) return [{ ...first, kind: record.kind, name: '' }];
  // "¼ cup milk (plus 2 tablespoons)": the parser did not add it, and the record's text would hide the rest.
  if (parsed.length === 1 && record.parts!.some(part => part.plus && part.quantity === first.quantity && part.unit === first.unit)) return parsed;
  return record.parts!.map((part, i) => {
    const base = parsed[i] ?? first;
    const same = parsed.length === record.parts!.length;
    const present = (n: number | undefined) => n !== undefined && numbers(record.line).some(v => Math.abs(v - n) < 0.01);
    // A part the parser did not split out still has to find its ingredient, or shopping rows stop adding up.
    const concept = lookupConcept(part.en, lookup) ?? (same ? null : exactConcept(part.en, lookup));
    const exact = concept !== null;
    const name = same && (!exact || concept === base.concept) && base.name ? base.name : part.en;
    const text = Object.fromEntries(['en', 'it'].map(language => {
      const en = language === 'en';
      const name = [part[en ? 'en' : 'it'], ...(part.alternatives ?? []).filter(a => a.quantity === undefined || (a.quantity === part.quantity && a.unit === part.unit)).slice(0, 3).map(a => a[en ? 'en' : 'it'])].join(en ? ' or ' : ' o ');
      const display = displays[language];
      const forms = display?.names[exact ? concept : base.concept ?? ''];
      const marker = (id: string, fallback: string) => display?.terms[id] ? termForm(display.terms[id]!, forms?.gender, forms ? nounForm(forms, base.quantityMax ?? base.quantity, !!base.unit).plural : false) : fallback;
      const note = [part[en ? 'preparationEn' : 'preparationIt'], part[en ? 'purposeEn' : 'purposeIt'],
        part.optional ? marker('term:optional', en ? 'optional' : 'facoltativo') : '', part.toTaste ? marker('term:to-taste', en ? 'to taste' : 'quanto basta') : ''].filter(Boolean).join(', ');
      return [language, { name, note }];
    }));
    return { ...base, ...(!same ? {
      quantity: present(part.quantity) ? part.quantity! : null,
      quantityMax: present(part.quantityMax) ? part.quantityMax! : null,
      unit: present(part.quantity) ? part.unit ?? null : null,
      metric: record.parts!.length === 1 ? first.metric : null, size: null, approx: undefined
    } : {}), kind: undefined, densityName: same ? base.densityName ?? (name !== base.name ? base.name : undefined) : part.en, text, name, phrase: same ? base.phrase : record.language === 'it' ? part.it : part.en, note: '', terms: same ? base.terms : [], also: null,
      optional: part.optional ?? false, concept: exact ? concept : parsed[i]?.concept ?? null,
      conceptExact: exact ? true : parsed[i]?.conceptExact };
  });
}
