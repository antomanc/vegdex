import { expect, test } from './fixtures';

const cards = (page: import('@playwright/test').Page) => page.getByTestId('recipe-card');

test('Italian ingredient search loads only its lookup and keeps original details and shared state', async ({ page }) => {
  const lookups: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/lookup/')) lookups.push(new URL(r.url()).pathname); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/it/?q=ceci');
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
  await expect.poll(() => lookups).toEqual(['/data/lookup/it.json']);
  await expect(page.getByRole('link', { name: 'Open Food Facts', exact: true })).toHaveAttribute('href', 'https://world.openfoodfacts.org/');
  await expect(page.getByRole('link', { name: 'Dizionario ingredienti', exact: true })).toHaveAttribute('href', '/data/dictionary.json');
  await page.getByRole('button', { name: 'Salva Lemony Quinoa Salad', exact: true }).click();
  await page.getByRole('button', { name: 'Lemony Quinoa Salad', exact: true }).click();
  await expect(page.getByTestId('ingredients')).toContainText('chickpeas');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Lemony Quinoa Salad', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/?\?q=ceci/);
  await page.getByRole('searchbox').fill('garbanzo');
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
  await expect(page.getByRole('button', { name: 'Unsave Lemony Quinoa Salad', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Italian have and avoid keep all-includes and any-exclude semantics across reloads', async ({ page }) => {
  await page.goto('/it/');
  await page.getByRole('button', { name: 'Altri filtri', exact: true }).click();
  await page.getByLabel('Deve contenere').fill('zucca');
  await page.getByLabel('Deve contenere').press('Enter');
  await expect(cards(page)).toHaveCount(2);
  await page.getByLabel('Da evitare').fill('funghi');
  await page.getByLabel('Da evitare').press('Enter');
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
  await page.getByLabel('Deve contenere').fill('ceci');
  await page.getByLabel('Deve contenere').press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(page).toHaveURL(/have=zucca%2Cceci/);
  await expect(page).toHaveURL(/avoid=funghi/);
  await page.reload();
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
});

test('English synonyms search the emitted concept data without title matches', async ({ page }) => {
  await page.goto('/?q=garbanzo');
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
  await page.getByRole('searchbox').fill('quinoa');
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
});
