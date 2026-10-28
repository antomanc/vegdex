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
});

test('each saved recipe has its own amount on the shopping list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 2/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();

  const list = page.getByRole('dialog');
  const garlic = list.locator('li', { hasText: 'garlic' });
  // Nobody has to touch the amounts: they start collapsed, at ×1.
  await expect(list.getByText('For 2 saved recipes', { exact: true })).toBeVisible();
  await expect(list.getByRole('button', { name: 'More servings of Spinach Tofu Curry' })).toBeHidden();
  await list.getByText('For 2 saved recipes').click();

  // The curry serves 4 and steps by servings: 8 servings doubles its 3 cloves.
  const curry = list.getByRole('button', { name: 'More servings of Spinach Tofu Curry' });
  for (let i = 0; i < 4; i++) await curry.click();
  await expect(list.getByText('8 servings')).toBeVisible();
  // The soup has no yield, so it steps by half batches: ×1½ of its 2 cloves.
  await list.getByRole('button', { name: 'More servings of Red Lentil Soup' }).click();
  await expect(list.getByText('×1½')).toBeVisible();
  await expect(garlic).toContainText('9 cloves');

  await page.reload();
  await expect(list.getByText('For 2 saved recipes · 2 adjusted')).toBeVisible();
  await expect(garlic).toContainText('9 cloves');

  await list.getByText('For 2 saved recipes').click();
  const fewer = list.getByRole('button', { name: 'Fewer servings of Red Lentil Soup' });
  await fewer.click();
  await fewer.click();
  await expect(fewer).toBeDisabled();
  await expect(garlic).toContainText('7 cloves');
});

test('a recipe saved again starts at one batch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  const list = page.getByRole('dialog');
  await list.getByText('For 1 saved recipe').click();
  await list.getByRole('button', { name: 'More servings of Spinach Tofu Curry' }).click();
  await list.getByRole('button', { name: 'Close' }).click();

  // Undoing a mis-tap in the saved view keeps the amount…
  await page.getByRole('button', { name: 'Unsave Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(list.getByText('For 1 saved recipe · 1 adjusted')).toBeVisible();
  await list.getByRole('button', { name: 'Close' }).click();

  // …but once the unsave is final, saving it again starts over.
  await page.getByRole('button', { name: 'Unsave Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'vegdex, all recipes' }).click();
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(list.getByText('For 1 saved recipe', { exact: true })).toBeVisible();

  // Outside the saved view there's no undo, so an unsave there is final straight away.
  await list.getByText('For 1 saved recipe').click();
  await list.getByRole('button', { name: 'More servings of Spinach Tofu Curry' }).click();
  await list.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'vegdex, all recipes' }).click();
  await page.getByRole('button', { name: 'Unsave Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: /Saved · 1/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  await expect(list.getByText('For 1 saved recipe', { exact: true })).toBeVisible();
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
