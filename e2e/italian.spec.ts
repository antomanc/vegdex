import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/it/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 ricette/);
});

test('/it/ is its own Italian page', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page).toHaveTitle(/vegdex: .*ricette vegane/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /ricette vegane/);
});

test('English stays at the root', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Desserts', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dolci', exact: true })).toHaveCount(0);
});

test('meal filters are in Italian while the URL keeps English identifiers', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Desserts', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dolci', exact: true }).click();
  await expect(page).toHaveURL(/\/it\/\?meal=dessert/);
  await expect(page.getByTestId('result-count')).toHaveText(/1 ricetta/);
  await page.reload();
  await expect(page.getByTestId('recipe-card')).toHaveText([/Fudgy Vegan Brownies/]);
  await expect(page.getByRole('button', { name: 'Dolci', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('a recipe opens and closes on /it/', async ({ page }) => {
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Red Lentil Soup' })).toBeVisible();
  await expect(sheet.getByTestId('ingredients').locator('li')).toHaveCount(6);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});

test('filters and result plurals follow the page language', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Stasera', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Ordina per' })).toContainText('Più votate');
  await page.getByRole('button', { name: 'Altri filtri', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Senza glutine', exact: true })).toBeVisible();
  await expect(sheet.getByLabel('Deve contenere')).toBeVisible();
  await sheet.getByRole('button', { name: 'Mostra 6 ricette', exact: true }).click();
  await page.getByRole('button', { name: 'Dolci', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText('1 ricetta');
  await expect(page.getByRole('button', { name: 'Rimuovi Dolci', exact: true })).toBeVisible();
});
