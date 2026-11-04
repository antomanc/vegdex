import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { parseIngredient } from '@vegdex/core';

test('qualified source amounts survive translated display and both unit choices', async ({ page }) => {
  const lines = ['about 2 tbsp olive oil', '2 heaped cups olive oil', '2 scant cups olive oil'];
  await page.route('**/data/details/15.json', (route) => {
    const details = JSON.parse(readFileSync(new URL('./fixtures/data/details/15.json', import.meta.url), 'utf8'));
    details['quinoa-salad'].ingredients = lines;
    details['quinoa-salad'].parsedIngredients = lines.map((line) => parseIngredient(line, { 'olive oil': 'off:4267eb72e56db0a2' }));
    return route.fulfill({ json: details });
  });
  await page.goto('/it/?r=quinoa-salad');
  const sheet = page.getByRole('dialog');
  for (const units of ['Metrico', 'USA']) {
    await sheet.getByRole('button', { name: units, exact: true }).click();
    // An approximate amount is shown as approximate; how full a cup is cannot be translated without losing it.
    await expect(sheet.getByTestId('ingredients').locator('li').first()).toHaveText("circa 2 cucchiai di olio d'oliva");
    for (const line of lines.slice(1)) await expect(sheet.getByTestId('ingredients').locator('li', { hasText: line })).toHaveText(line);
  }
});

test('Italian ingredient lines keep amounts and preparation notes with source originals one action away', async ({ page }) => {
  await page.goto('/it/?r=quinoa-salad');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('ingredients')).toContainText('400 g di ceci, scolati e sciacquati');
  await expect(sheet.getByTestId('ingredients')).toContainText("2 cucchiai di olio d'oliva");
  await sheet.getByText('Ingredienti originali', { exact: true }).click();
  await expect(sheet.getByTestId('original-ingredients')).toContainText('400 g chickpeas, drained and rinsed');
  await expect(sheet.getByTestId('original-ingredients')).toContainText('2 tbsp olive oil');
});

const it = (forms: string) => ({ m: forms, f: forms, 'm.pl': forms, 'f.pl': forms });
for (const [what, overlay] of [
  ['preparation term', { names: { 'off:7ed0f0da39d5b63b': { one: 'cece', other: 'ceci', gender: 'm' } }, terms: { 'term:drained-rinsed': it('con latte') } }],
  ['ingredient name', { names: { 'off:7ed0f0da39d5b63b': { one: 'pollo', other: 'polli', gender: 'm' } }, terms: { 'term:drained-rinsed': it('scolati e sciacquati') } }]
] as const) {
  test(`an unsafe ${what} in the vocabulary keeps the complete original ingredient`, async ({ page }) => {
    await page.route('**/data/overlay/it.json', (route) => route.fulfill({ json: { language: 'it', titles: {}, units: { g: ['g', 'g'] }, ...overlay } }));
    await page.goto('/it/?r=quinoa-salad');
    await expect(page.getByRole('dialog').getByTestId('ingredients')).toContainText('400 g chickpeas, drained and rinsed');
    await expect(page.getByRole('dialog').getByTestId('ingredients')).not.toContainText(/ceci|poll/);
  });
}

test('Italian shopping names retain merged totals, scaling and ticks across language changes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Fluffy Vegan Pancakes', exact: true }).click();
  await page.getByRole('button', { name: 'Save Fudgy Vegan Brownies', exact: true }).click();
  await page.getByRole('button', { name: 'Saved · 2', exact: true }).click();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  let sheet = page.getByRole('dialog');
  await sheet.getByRole('checkbox', { name: /cornstarch/ }).check();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('footer').getByRole('link', { name: 'Italiano', exact: true }).click();
  await page.getByRole('button', { name: 'Lista della spesa', exact: true }).click();
  sheet = page.getByRole('dialog');
  const groceries = sheet.getByTestId('grocery-list');
  await expect(groceries.locator('li', { hasText: 'amido di mais' })).toHaveCount(1);
  await expect(groceries.locator('li', { hasText: 'amido di mais' })).toContainText('3 cucchiai');
  await expect(groceries.getByRole('checkbox', { name: /amido di mais/ })).toBeChecked();
  await sheet.locator('summary').click();
  await sheet.getByRole('button', { name: 'Aumenta le porzioni di Pancake vegani soffici', exact: true }).click();
  await expect(groceries.locator('li', { hasText: 'amido di mais' })).toContainText('3 ¼ cucchiai');
  await expect(groceries.getByRole('checkbox', { name: /amido di mais/ })).toBeChecked();
});

test('a line naming two measured ingredients shows each part in Italian and as written in English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vegdex:units', localStorage.getItem('vegdex:units') ?? 'us'));
  await page.goto('/?r=lentil-soup');
  const lines = page.getByRole('dialog').getByTestId('ingredients').locator('li');
  await expect(lines.filter({ hasText: 'cornstarch' })).toHaveText(['1 tbsp cornstarch + 1/2 cup water']);
  // In metric each part gets its own amount; the spoon stays a spoon.
  await page.getByRole('dialog').getByRole('button', { name: 'Metric', exact: true }).click();
  await expect(lines.filter({ hasText: 'cornstarch' })).toHaveText(['1 tbsp cornstarch + 120 ml water']);
  await page.getByRole('dialog').getByRole('button', { name: 'US', exact: true }).click();
  await page.goto('/it/?r=lentil-soup');
  await expect(lines.filter({ hasText: 'amido di mais' })).toHaveText(['1 cucchiaio di amido di mais']);
  await expect(lines.filter({ hasText: 'acqua' })).toHaveText(['½ tazza di acqua']);
  // The shopping list buys the water too, with its own amount.
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Red Lentil Soup', exact: true }).click();
  await page.getByRole('button', { name: 'Saved · 1', exact: true }).click();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  const groceries = page.getByRole('dialog').getByTestId('grocery-list');
  await expect(groceries.getByRole('checkbox', { name: /^water/ })).toHaveCount(1);
  await expect(groceries.locator('li').filter({ has: page.getByRole('checkbox', { name: /^water/ }) })).toContainText('½ cup');
});

test('an ingredient after an embedded weight is never dropped from the recipe sheet', async ({ page }) => {
  const line = '4 x-large (15g) minced garlic cloves';
  await page.route('**/data/details/15.json', (route) => {
    const details = JSON.parse(readFileSync(new URL('./fixtures/data/details/15.json', import.meta.url), 'utf8'));
    details['quinoa-salad'].ingredients = [line];
    details['quinoa-salad'].parsedIngredients = [parseIngredient(line, { garlic: 'off:41024084d2e27b7d' })];
    return route.fulfill({ json: details });
  });
  for (const path of ['/', '/it/']) {
    await page.goto(`${path}?r=quinoa-salad`);
    await expect(page.getByRole('dialog').getByTestId('ingredients').locator('li')).toHaveText(line);
  }
});
