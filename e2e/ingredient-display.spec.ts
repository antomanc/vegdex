import { expect, test } from './fixtures';

test('Italian ingredient lines keep amounts and preparation notes with source originals one action away', async ({ page }) => {
  await page.goto('/it/?r=quinoa-salad');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('ingredients')).toContainText('400 g ceci, scolati e sciacquati');
  await expect(sheet.getByTestId('ingredients')).toContainText("2 cucchiai olio d'oliva");
  await sheet.getByText('Ingredienti originali', { exact: true }).click();
  await expect(sheet.getByTestId('original-ingredients')).toContainText('400 g chickpeas, drained and rinsed');
  await expect(sheet.getByTestId('original-ingredients')).toContainText('2 tbsp olive oil');
});

test('missing or unsafe preparation translations retain the complete original ingredient', async ({ page }) => {
  await page.route('**/data/overlay/it.json', (route) => route.fulfill({ json: {
    language: 'it', titles: {}, ingredients: {
      names: { 'off:7ed0f0da39d5b63b': 'ceci' },
      units: { g: ['g', 'g'] }, notes: { 'drained and rinsed': 'con latte' }
    }
  } }));
  await page.goto('/it/?r=quinoa-salad');
  await expect(page.getByRole('dialog').getByTestId('ingredients')).toContainText('400 g chickpeas, drained and rinsed');
  await expect(page.getByRole('dialog').getByTestId('ingredients')).not.toContainText('ceci');
});

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
