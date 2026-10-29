import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test('metric weighs the ingredients and the choice sticks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  const sheet = page.getByRole('dialog');
  const flour = sheet.getByTestId('ingredients').locator('li', { hasText: 'all-purpose flour' });
  // An en-US browser starts in cups.
  await expect(flour).toHaveText('2 cups all-purpose flour');

  await sheet.getByRole('button', { name: 'Metric' }).click();
  await expect(flour).toHaveText('≈ 250 g all-purpose flour');
  await expect(sheet.getByText(/Weighed from cups/)).toBeVisible();

  // The open recipe is in the URL, so the reload brings the sheet back.
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Metric' })).toHaveAttribute('aria-pressed', 'true');
  await expect(flour).toHaveText('≈ 250 g all-purpose flour');
});

test('the shopping list adds up in grams', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();

  const list = page.getByRole('dialog');
  await list.getByRole('button', { name: 'Metric' }).click();
  const lentils = list.getByTestId('grocery-list').locator('li', { hasText: 'red lentil' });
  await expect(lentils).toContainText('≈ 190 g');
  await list.getByText('For 1 saved recipe').click();
  await list.getByRole('button', { name: 'More servings of Red Lentil Soup' }).click();
  await list.getByRole('button', { name: 'More servings of Red Lentil Soup' }).click();
  await expect(lentils).toContainText('≈ 380 g');
});

const ingredients = (page: Page) => page.getByRole('dialog').getByTestId('ingredients');

async function openPancakes(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: path === '/it/' ? 'Pancake vegani soffici' : 'Fluffy Vegan Pancakes', exact: true }).click();
}

// The English page keeps following the browser's region; the Italian page is metric whatever the browser says.
for (const { locale, english, italian } of [
  { locale: 'en-US', english: '2 cups all-purpose flour', italian: '≈ 250 g all-purpose flour' },
  { locale: 'it-IT', english: '≈ 250 g all-purpose flour', italian: '≈ 250 g all-purpose flour' },
  { locale: 'en-GB', english: '≈ 250 g all-purpose flour', italian: '≈ 250 g all-purpose flour' }
]) {
  test.describe(`page defaults with a ${locale} browser`, () => {
    test.use({ locale });

    test('English follows the browser region and Italian starts in metric', async ({ page }) => {
      await openPancakes(page, '/');
      await expect(ingredients(page)).toContainText(english);
      await openPancakes(page, '/it/');
      await expect(ingredients(page)).toContainText(italian);
    });
  });
}

for (const { path, other, choice, amount } of [
  { path: '/', other: '/it/', choice: 'Metric', amount: '≈ 250 g all-purpose flour' },
  { path: '/it/', other: '/', choice: 'USA', amount: '2 cups all-purpose flour' }
]) {
  test(`a ${choice} choice on ${path} holds in both languages`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole('button', { name: path === '/it/' ? 'Pancake vegani soffici' : 'Fluffy Vegan Pancakes', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: choice, exact: true }).click();
    for (const language of [other, path]) {
      await page.goto(language);
      await page.getByRole('button', { name: language === '/it/' ? 'Pancake vegani soffici' : 'Fluffy Vegan Pancakes', exact: true }).click();
      await expect(page.getByRole('dialog').getByTestId('ingredients')).toContainText(amount);
      await page.reload();
      await expect(page.getByRole('dialog').getByTestId('ingredients')).toContainText(amount);
    }
  });
}
