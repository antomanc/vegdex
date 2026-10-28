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
  await expect(list.locator('li', { hasText: 'red lentil' })).toContainText('≈ 190 g');
  await list.getByRole('button', { name: '×2' }).click();
  await expect(list.locator('li', { hasText: 'red lentil' })).toContainText('≈ 380 g');
});

test.describe('outside the US', () => {
  test.use({ locale: 'it-IT' });

  test('starts in metric', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
    await expect(page.getByRole('dialog').getByTestId('ingredients')).toContainText('≈ 250 g all-purpose flour');
  });
});
