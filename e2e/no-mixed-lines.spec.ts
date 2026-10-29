import fs from 'node:fs';
import { isHiddenLine, shardOf, type LanguageVocabulary, type ParsedIngredient } from '@vegdex/core';
import { expect, italianFixtureData, test } from './fixtures';

// A line shown in another language is composed entirely from the vocabulary, or shown exactly as written:
// never a converted amount beside a name in the recipe's own language ("≈ 55 g oil for frying").
const read = (variant: string, file: string) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${variant}/${file}`, import.meta.url), 'utf8'));
const tidy = (line: string) => line.replace(/\(\(/g, '(').replace(/\)\)/g, ')').replace(/\s+/g, ' ').trim();

for (const { variant, path, language } of [
  { variant: 'data', path: '/it/', language: 'it' },
  { variant: 'italian-data', path: '/', language: 'en' }
] as const) {
  const overlay = read(variant, `overlay/${language}.json`) as LanguageVocabulary;
  const names = Object.values(overlay.names).flatMap((n) => [n.one, n.other]);
  const recipes = (read(variant, 'catalog.json').recipes as { id: string; contentLanguage: string }[]).filter((r) => r.contentLanguage !== language);
  for (const units of ['metric', 'us'] as const) {
    test(`every ${language} line on ${variant} recipes is composed or exactly as written, in ${units} units`, async ({ page }) => {
      if (variant === 'italian-data') await page.route('**/data/**', italianFixtureData);
      await page.addInitScript((u) => localStorage.setItem('vegdex:units', u), units);
      for (const recipe of recipes) {
        const details = read(variant, `details/${String(shardOf(recipe.id)).padStart(2, '0')}.json`)[recipe.id] as { ingredients: string[]; parsedIngredients: ParsedIngredient[] };
        await page.goto(`${path}?r=${recipe.id}`);
        const visible = details.ingredients.map((_, i) => i).filter((i) => !isHiddenLine(details.parsedIngredients[i], language, recipe.contentLanguage));
        const lines = page.getByRole('dialog').getByTestId('ingredients').locator('li');
        await expect(lines).toHaveCount(visible.length);
        const shown = await lines.allInnerTexts();
        shown.forEach((text, n) => {
          const i = visible[n]!;
          if (tidy(text) === tidy(details.ingredients[i]!)) return;
          const phrase = details.parsedIngredients[i]!.phrase?.toLowerCase();
          if (phrase && !names.some((n) => n.toLowerCase().includes(phrase)))
            expect(text.toLowerCase(), `${recipe.id}: "${details.ingredients[i]}"`).not.toContain(phrase);
        });
      }
    });
  }
}

test('the reported sweet and sour tofu reads as clean lines or as written, never mixed', async ({ page }) => {
  const { parseIngredient } = await import('@vegdex/core');
  const { loadVocabulary } = await import('../packages/ingest/src/vocab');
  const lookup = loadVocabulary().lookup('en');
  const lines = [
    '1 (16 ounce) block firm tofu (or extra firm tofu pressed, and torn into 1 to 2 inch pieces)',
    '1 tablespoon soy sauce (gluten free if needed, or liquid aminos or tamari)', '1/2 teaspoon garlic powder', '1/4 teaspoon sea salt',
    '1/4 teaspoon ground black pepper', '1/3 cup cornstarch', '1/4 cup oil for frying', '1/2 medium red onion (chopped)',
    '1/2 cup chopped/cubed pineapple', '1 medium bell pepper, chopped',
    '1/3 cup sugar (I use cane sugar, you can use brown or any granulated (you could even use 1/4 cup sugar)', '1/4 cup ketchup',
    '1/4 cup vinegar (preferably rice or white)', '1/4 cup water (or pineapple juice)', '1/2 tablespoon sesame seeds (for garnish)', 'chopped scallion (for garnish)'
  ];
  const parsed = lines.map((line) => parseIngredient(line, lookup));
  await page.route('**/data/details/15.json', (route) => {
    const details = read('data', 'details/15.json');
    details['quinoa-salad'] = { ingredients: lines, parsedIngredients: parsed };
    return route.fulfill({ json: details });
  });
  await page.addInitScript(() => localStorage.setItem('vegdex:units', 'metric'));
  await page.goto('/it/?r=quinoa-salad');
  const shown = page.getByRole('dialog').getByTestId('ingredients').locator('li');
  await expect(shown).toHaveCount(lines.length);
  const texts = await shown.allInnerTexts();
  expect(texts).toContain('454 g tofu compatto');
  expect(texts).toContain('1 cucchiaio di salsa di soia');
  texts.forEach((text, i) => {
    if (tidy(text) !== tidy(lines[i]!)) expect(text, lines[i]).not.toMatch(/\b(?:oil|onion|pineapple|pepper|sugar|vinegar|water|seeds|scallion|garlic|salt|tablespoon|teaspoon|cup)\b/i);
  });
});
