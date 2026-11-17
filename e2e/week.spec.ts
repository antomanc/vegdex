import { expect, test } from './fixtures';

test('My week plans dinners from the mains, swaps one out, and saves them as the shopping list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  await page.getByRole('button', { name: 'My week' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your week' });
  const rows = sheet.getByTestId('week-list').getByRole('listitem');
  // The fixture has two mains: both make the week, and nothing else does.
  await expect(rows).toHaveCount(2);
  await expect(sheet.getByTestId('week-list')).toContainText('Spinach Tofu Curry');
  await expect(sheet.getByTestId('week-list')).toContainText('Mushroom Tofu Stir Fry');
  await expect(sheet.getByTestId('week-shop')).toHaveText(/\d+ things to buy for the week/);

  // A swap with no other main left drops the dinner rather than bringing back a turned-down one.
  await sheet.getByRole('button', { name: 'Swap Mushroom Tofu Stir Fry' }).click();
  await expect(rows).toHaveCount(1);
  await sheet.getByRole('button', { name: 'New week' }).click();
  await expect(sheet.getByText('No dinners match these filters.', { exact: false })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'My week' }).click();
  await expect(rows).toHaveCount(2);
  await sheet.getByRole('button', { name: 'Save and make the list' }).click();
  const list = page.getByRole('dialog', { name: 'Shopping list' });
  await expect(list.getByText('For 2 saved recipes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved · 2' })).toBeVisible();
});

test('the week follows the cook\'s filters: a course chosen is the course planned', async ({ page }) => {
  await page.goto('/?meal=soup');
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe/);
  await page.getByRole('button', { name: 'My week' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your week' });
  await expect(sheet.getByTestId('week-list').getByRole('listitem')).toHaveText([/Red Lentil Soup/]);
});
