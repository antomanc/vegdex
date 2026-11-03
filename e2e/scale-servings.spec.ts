import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openPancakes(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: path === '/it/' ? 'Pancake vegani soffici' : 'Fluffy Vegan Pancakes', exact: true }).click();
  return page.getByRole('dialog');
}

const twice = async (page: Page, name: string) => {
  for (let i = 0; i < 4; i++) await page.getByRole('dialog').getByRole('button', { name }).click();
};

test('doubling the servings doubles the amounts, and reset brings them back', async ({ page }) => {
  const sheet = await openPancakes(page, '/');
  const flour = sheet.getByTestId('ingredients').locator('li', { hasText: 'all-purpose flour' });
  const milk = sheet.getByTestId('ingredients').locator('li', { hasText: 'almond milk' });
  await expect(flour).toHaveText('2 cups all-purpose flour');

  await twice(page, 'More servings');
  await expect(sheet.getByText('8 servings')).toBeVisible();
  await expect(flour).toHaveText('4 cups all-purpose flour');
  await expect(milk).toHaveText('3 cups almond milk');
  await expect(sheet.getByTestId('scale-note')).toContainText('Serves 4 · scaled to 8');

  await sheet.getByRole('button', { name: 'Metric' }).click();
  await expect(flour).toHaveText('≈ 500 g all-purpose flour');

  await sheet.getByRole('button', { name: 'Reset' }).click();
  await expect(flour).toHaveText('≈ 250 g all-purpose flour');
  await expect(sheet.getByTestId('scale-note')).toHaveCount(0);
});

test('the Italian page doubles the composed amounts', async ({ page }) => {
  const sheet = await openPancakes(page, '/it/');
  const flour = sheet.getByTestId('ingredients').locator('li', { hasText: 'farina 00' });
  await expect(flour).toHaveText('≈ 250 g di farina 00');
  await twice(page, 'Più porzioni');
  await expect(flour).toHaveText('≈ 500 g di farina 00');
  await sheet.getByRole('button', { name: 'Ripristina' }).click();
  await expect(flour).toHaveText('≈ 250 g di farina 00');
});

test('a recipe without a yield scales in half batches, and unmeasured lines stay as written', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'More servings' }).click();
  await expect(sheet.getByText('×1½', { exact: true })).toBeVisible();
  const ingredients = sheet.getByTestId('ingredients');
  await expect(ingredients.locator('li', { hasText: 'red lentils' })).toHaveText('1 ½ cups red lentils');
  await expect(ingredients.locator('li', { hasText: 'salt' })).toHaveText('salt to taste');
});
