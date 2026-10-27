import { expect, test } from './fixtures';

const cards = (page: import('@playwright/test').Page) => page.getByTestId('recipe-card');
const count = (page: import('@playwright/test').Page) => page.getByTestId('result-count');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(count(page)).toHaveText(/6 recipes/);
});

test('shows only vegan recipes, best rated first', async ({ page }) => {
  await expect(cards(page).first()).toContainText('Fluffy Vegan Pancakes');
  // The fixture's honey recipe is dropped by the vegan check at emit time.
  await expect(page.getByText('Honey Glazed Carrots')).toHaveCount(0);
});

test('flavor and meal pills narrow the grid', async ({ page }) => {
  await page.getByRole('button', { name: 'Sweet', exact: true }).click();
  await expect(count(page)).toHaveText(/2 recipes/);
  await page.getByRole('button', { name: 'Desserts', exact: true }).click();
  await expect(count(page)).toHaveText(/1 recipe/);
  await expect(cards(page)).toHaveText(/Fudgy Vegan Brownies/);
});

test('time and high-protein filters', async ({ page }) => {
  await page.getByRole('button', { name: '≤ 15 min', exact: true }).click();
  await expect(cards(page)).toHaveText([/Lemony Quinoa Salad/]);
  await page.getByRole('button', { name: '≤ 15 min', exact: true }).click();
  await page.getByRole('button', { name: 'High protein', exact: true }).click();
  await expect(cards(page)).toHaveText([/Spinach Tofu Curry/]);
});

test('search matches titles and ingredients', async ({ page }) => {
  await page.getByRole('searchbox').fill('lentil');
  await expect(cards(page)).toHaveText([/Red Lentil Soup/]);
});

test('have / avoid ingredients', async ({ page }) => {
  await page.getByRole('button', { name: /More filters/ }).click();
  await page.getByLabel('I have').fill('tofu');
  await page.getByLabel('I have').press('Enter');
  await expect(count(page)).toHaveText(/2 recipes/);
  await page.getByLabel('Avoid').fill('mushrooms');
  await page.getByLabel('Avoid').press('Enter');
  await expect(cards(page)).toHaveText([/Spinach Tofu Curry/]);
});

test('filters survive a reload through the URL', async ({ page }) => {
  await page.getByRole('button', { name: 'Soups', exact: true }).click();
  await expect(page).toHaveURL(/meal=soup/);
  await page.reload();
  await expect(cards(page)).toHaveText([/Red Lentil Soup/]);
});

test('opening a recipe shows ingredients and links to the creator', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Red Lentil Soup' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Red Lentil Soup' })).toBeVisible();
  await expect(sheet.getByTestId('ingredients').locator('li')).toHaveCount(6);
  await expect(sheet.getByRole('link', { name: /Cook it on ElaVegan/ })).toHaveAttribute('href', 'https://example.com/lentil-soup/');
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});

test('active filters stay visible and can be removed one by one', async ({ page }) => {
  await page.getByRole('button', { name: 'Sweet', exact: true }).click();
  await page.getByRole('button', { name: 'Desserts', exact: true }).click();
  const active = page.getByRole('list', { name: 'Active filters' });
  await expect(active.getByRole('button', { name: /^Remove/ })).toHaveCount(2);

  await active.getByRole('button', { name: 'Remove Desserts' }).click();
  await expect(count(page)).toHaveText(/2 recipes/);
  await active.getByRole('button', { name: 'Remove Sweet' }).click();
  await expect(count(page)).toHaveText(/6 recipes/);
  await expect(active).toHaveCount(0);
});

test('an empty result offers a way back', async ({ page }) => {
  await page.getByRole('searchbox').fill('lentil');
  await page.getByRole('button', { name: 'Desserts', exact: true }).click();
  await expect(page.getByText('No recipes match “lentil” with these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards(page)).toHaveText([/Red Lentil Soup/]);
});
