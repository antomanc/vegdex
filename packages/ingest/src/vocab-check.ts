import {
  findUnsafeRenderedTerms, ingredientKey, isQualifiedIngredient, isTermId, languagePacks,
  type Gender, type NounForms
} from '@vegdex/core';
import type { Concept } from './concepts';
import type { Vocabulary } from './vocab';

/**
 * One check per vocabulary entry. `vocab:apply` rejects proposals with them, and a test runs them
 * over the committed files, so hand edits get the same scrutiny as model output.
 */

const text = (v: unknown, max = 60): v is string => typeof v === 'string' && !!v.trim() && v === v.trim() && v.length <= max;
const numbers = (value: string) => (value.match(/\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞]/g) ?? []).map((n) => n.replace(',', '.')).sort().join('|');

/** Conservative lexical checks catch unchanged source prose; they do not prove meaning. */
const foreign: Record<string, RegExp> = {
  it: /\b(?:the|and|with|without|drained|rinsed|chopped|minced|sifted|thoroughly|milk|butter|chicken|honey|eggs|fresh|sliced|diced)\b/i,
  en: /\b(?:con|senza|scolati|sciacquati|tritato|tritata|setacciata|quanto|cucchiai|spicchi|della|delle|alla)\b/i
};
const looksForeign = (language: string, value: string) => !!foreign[language]?.test(value);

/** Concept aliases name one whole ingredient: no alternatives, purposes, amounts or notes. */
const STRUCTURAL = /[,;()/\d]|\b(?:or|and|with|for|to taste|as needed|if needed|optional|divided|plus)\b/i;

export function checkAlias(vocab: Vocabulary, language: string, phrase: string, id: string): string | null {
  if (!Object.hasOwn(languagePacks, language)) return 'unsupported-language';
  if (!text(phrase, 80) || ingredientKey(phrase) !== phrase) return 'malformed';
  if (isTermId(id)) {
    if (!termExists(vocab, id)) return 'unknown-term';
    if (/\d/.test(phrase) || phrase.split(/\s+/).length > 6) return 'not-a-term';
    if (isQualifiedIngredient(phrase) || findUnsafeRenderedTerms(phrase, language).length) return 'unsafe';
    return null;
  }
  const concept = vocab.byId.get(id);
  if (!concept) return 'unknown-concept';
  if (STRUCTURAL.test(phrase)) return 'not-whole';
  // An alias naming an animal product must not hide behind a plant concept; mapping it to the animal concept is evidence.
  if (concept.vegan !== 'no' && findUnsafeRenderedTerms(phrase, language).length) return 'unsafe';
  // "vegan sugar" is sugar; "vegan butter" must never become a concept plainly named butter.
  if (isQualifiedIngredient(phrase) && (concept.vegan === 'no' || namedAsAnimal(concept))) return 'qualification-lost';
  return null;
}

function namedAsAnimal(concept: Concept): boolean {
  return (concept.names.en ?? []).some((name) => !isQualifiedIngredient(name) && findUnsafeRenderedTerms(name, 'en').length > 0);
}

/** A concept every English name of which is plant-qualified ("vegan butter") must keep that in every language. */
function allQualified(concept: Concept): boolean {
  const names = concept.names.en ?? [];
  return names.length > 0 && names.every(isQualifiedIngredient);
}

function termExists(vocab: Vocabulary, id: string): boolean {
  return Object.values(vocab.files).some((file) => Object.hasOwn(file.terms, id));
}

/** "farina 00" and "5-spice powder" are names; "200 g" and "2 cups" are amounts. */
const AMOUNT = /\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cups?|tbsp|tsp|oz|lb|gramm[oi]|tazz[ae]|cucchia(?:i|io|ini|ino))\b/i;

function nameText(language: string, value: unknown): string | null {
  if (!text(value) || AMOUNT.test(value)) return 'malformed';
  if (findUnsafeRenderedTerms(value, language).length) return 'unsafe';
  if (looksForeign(language, value)) return 'wrong-language';
  return null;
}

export function checkName(vocab: Vocabulary, language: string, id: string, value: unknown): string | null {
  const pack = languagePacks[language];
  if (!pack) return 'unsupported-language';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'malformed';
  const forms = value as Partial<NounForms>;
  const concept = vocab.byId.get(id);
  if (!concept) return 'unknown-concept';
  if (concept.vegan === 'no') return 'animal-concept';
  if (Object.keys(forms).some((k) => !['one', 'other', 'gender'].includes(k))) return 'malformed';
  for (const form of [forms.one, forms.other]) {
    const problem = nameText(language, form);
    if (problem) return problem;
  }
  if (pack.genders ? !pack.genders.includes(forms.gender as Gender) : forms.gender !== undefined) return 'gender';
  if (allQualified(concept) && (!isQualifiedIngredient(forms.one!) || !isQualifiedIngredient(forms.other!))) return 'qualification-lost';
  return null;
}

export function termKeys(language: string): string[] | null {
  const genders = languagePacks[language]?.genders;
  return genders ? genders.flatMap((g) => [g, `${g}.pl`]) : null;
}

export function checkTerm(language: string, value: unknown): string | null {
  if (!Object.hasOwn(languagePacks, language)) return 'unsupported-language';
  const keys = termKeys(language);
  const forms: unknown[] = keys
    ? (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length ? keys.map((k) => (value as Record<string, unknown>)[k]) : [undefined])
    : [value];
  for (const form of forms) {
    const problem = nameText(language, form);
    if (problem) return problem;
    if (isQualifiedIngredient(form as string)) return 'unsafe';
  }
  return null;
}

export function checkTitle(language: string, original: string, value: unknown): string | null {
  if (!Object.hasOwn(languagePacks, language)) return 'unsupported-language';
  if (!text(value, 200)) return 'malformed';
  if (numbers(original) !== numbers(value)) return 'quantity-changed';
  if (findUnsafeRenderedTerms(value, language).length) return 'unsafe';
  if (looksForeign(language, value)) return 'wrong-language';
  return null;
}

export function checkVocabulary(vocab: Vocabulary): string[] {
  const problems: string[] = [];
  const report = (where: string, problem: string | null) => { if (problem) problems.push(`${where}: ${problem}`); };
  const ids = new Set(vocab.added.map((c) => c.id));
  for (const c of vocab.added) {
    if (!/^vocab:[a-z0-9-]+$/.test(c.id)) report(c.id, 'malformed-id');
    if (!text(c.gloss, 80) || findUnsafeRenderedTerms(c.gloss, 'en').length) report(c.id, 'unsafe-gloss');
    for (const parent of c.parents) if (!vocab.byId.has(parent) || vocab.byId.get(parent)!.vegan === 'no') report(c.id, `parent ${parent}`);
  }
  if (ids.size !== vocab.added.length) problems.push('concepts.json: duplicate IDs');
  for (const [language, file] of Object.entries(vocab.files)) {
    for (const [phrase, id] of Object.entries(file.aliases)) report(`${language} alias "${phrase}"`, checkAlias(vocab, language, phrase, id));
    for (const [id, forms] of Object.entries(file.names)) report(`${language} name ${id}`, checkName(vocab, language, id, forms));
    for (const [id, forms] of Object.entries(file.terms)) {
      if (!/^term:[a-z0-9-]+$/.test(id)) report(`${language} term ${id}`, 'malformed-id');
      report(`${language} term ${id}`, checkTerm(language, forms));
    }
    for (const [original, title] of Object.entries(file.titles)) report(`${language} title "${original}"`, checkTitle(language, original, title));
    for (const unit of Object.values(file.units)) if (!Array.isArray(unit) || unit.length !== 2 || !unit.every((u) => text(u))) report(`${language} units`, 'malformed');
  }
  return problems;
}

/** "term:finely-chopped" from "finely chopped"; "vocab:lunar-flour" from a gloss. */
export const slug = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
