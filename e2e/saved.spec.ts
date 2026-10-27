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

test('browse filters never hide saved recipes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Desserts', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe$/);

  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe saved/);
  await expect(page.getByTestId('recipe-card')).toHaveText([/Spinach Tofu Curry/]);
});

test('shopping list check-offs survive closing the list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();

  const list = page.getByRole('dialog');
  await list.getByRole('checkbox', { name: /garlic/ }).check();
  await list.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /garlic/ })).toBeChecked();

  await page.getByRole('dialog').getByRole('button', { name: 'Uncheck all' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /garlic/ })).not.toBeChecked();
});

test('unsaving in the saved view can be undone until you leave it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 2/ }).click();

  await page.getByRole('button', { name: 'Unsave Spinach Tofu Curry' }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe saved/);
  await expect(page.getByTestId('recipe-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/2 recipes saved/);
});

test('shopping list ticks belong to that list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await page.getByRole('dialog').getByRole('checkbox', { name: /spinach/i }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Swap the curry for the soup: spinach leaves the list and takes its tick with it.
  await page.getByRole('button', { name: 'Unsave Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'vegdex, all recipes' }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /garlic/i })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'vegdex, all recipes' }).click();
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 2/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: /spinach/i })).not.toBeChecked();
});

test('the shopping list has its own address', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(page).toHaveURL(/list=1/);
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Shopping list' })).toBeVisible();
});
