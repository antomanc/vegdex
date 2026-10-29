import { expect, test } from './fixtures';

test('recipe notes stay on the sheet and out of the scaled shopping list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spinach Tofu Curry', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('ingredients')).toContainText('Serve with my Vegan Lemon Cream Sauce');
  await expect(sheet.getByTestId('ingredients')).toContainText('1 ½ tbsp chipotle peppers in adobo sauce, finely chopped');
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  const list = page.getByRole('dialog');
  const groceries = list.getByTestId('grocery-list');
  const chipotle = groceries.locator('li', { hasText: 'chipotle peppers in adobo sauce' });
  await expect(chipotle).toContainText('1 ½ tbsp');
  await expect(groceries.locator('li').filter({ hasText: /serve with/i })).toHaveCount(0);

  await list.getByText('For 1 saved recipe').click();
  const more = list.getByRole('button', { name: 'More servings of Spinach Tofu Curry' });
  for (let i = 0; i < 4; i++) await more.click();
  await expect(list.getByText('8 servings')).toBeVisible();
  await expect(chipotle).toContainText('3 tbsp');
});
