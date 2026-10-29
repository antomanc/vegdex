import { expect, test } from './fixtures';

test('Italian titles preserve source titles and appear in saved recipes and the shopping list', async ({ page }) => {
  await page.goto('/it/?q=pancakes');
  await expect(page.getByRole('button', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salva Pancake vegani soffici', exact: true }).click();
  await page.getByRole('button', { name: 'Pancake vegani soffici', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await expect(sheet.getByText('Fluffy Vegan Pancakes', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Cucina la ricetta su/ })).toHaveAttribute('href', 'https://example.com/pancakes/');
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: /Salvate/ }).first().click();
  await expect(page.getByRole('button', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Lista della spesa/ }).click();
  await page.getByRole('dialog').locator('summary').click();
  await expect(page.getByRole('dialog').getByText('Pancake vegani soffici', { exact: true })).toBeVisible();
});

test('unsafe title translations fall back to originals at display time', async ({ page }) => {
  await page.route('**/data/overlay/it.json', (route) => route.fulfill({ json: {
    language: 'it', titles: { 'Fluffy Vegan Pancakes': 'Pancake al burro' }
  } }));
  await page.goto('/it/?q=pancakes');
  await expect(page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
  await expect(page.getByText('Pancake al burro', { exact: true })).toHaveCount(0);
});

test('unavailable overlays keep the catalog browsable and missing titles retain originals', async ({ page }) => {
  await page.route('**/data/overlay/it.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('/it/?q=pancakes');
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
  await page.goto('/it/?q=spinach');
  await expect(page.getByRole('button', { name: 'Spinach Tofu Curry', exact: true })).toBeVisible();
});
