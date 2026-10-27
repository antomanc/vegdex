import { expect, test } from './fixtures';

test('saved recipes persist and build a combined shopping list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.reload();

  await page.getByRole('button', { name: /Saved · 2/ }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/2 recipes saved/);

  await page.getByRole('button', { name: 'Shopping list' }).click();
  const list = page.getByRole('dialog');
  // Garlic appears in both recipes (3 + 2 cloves) and is merged into one line.
  await expect(list.getByText('garlic', { exact: true })).toHaveCount(1);
  await expect(list.locator('li', { hasText: 'garlic' })).toContainText('5 cloves');
  await list.getByRole('button', { name: '×2' }).click();
  await expect(list.locator('li', { hasText: 'garlic' })).toContainText('10 cloves');
});

test('empty saved view explains what to do', async ({ page }) => {
  await page.goto('/?view=saved');
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
});
