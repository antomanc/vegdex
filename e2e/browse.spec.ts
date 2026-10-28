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
  await page.getByLabel('Must include').fill('tofu');
  await page.getByLabel('Must include').press('Enter');
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
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
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

test('back closes the recipe sheet instead of leaving the app', async ({ page }) => {
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await expect(page).toHaveURL(/r=lentil-soup/);
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(count(page)).toHaveText(/6 recipes/);
  await expect(page).not.toHaveURL(/r=/);
});

test('back closes More filters and keeps what was chosen in it', async ({ page }) => {
  await page.getByRole('button', { name: /More filters/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gluten-free', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(count(page)).toHaveText(/2 recipes/);
  await expect(page).toHaveURL(/free=gluten-free/);
});

test('ingredients typed but not added still apply when More filters closes', async ({ page }) => {
  await page.getByRole('button', { name: /More filters/ }).click();
  await page.getByLabel('Must include').fill('tofu, spinach');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(cards(page)).toHaveText([/Spinach Tofu Curry/]);
  const active = page.getByRole('list', { name: 'Active filters' });
  await expect(active.getByRole('button', { name: 'Remove with spinach' })).toBeVisible();
});

test('Tonight is one tap to a weeknight main', async ({ page }) => {
  await page.getByRole('button', { name: 'Tonight', exact: true }).click();
  await expect(count(page)).toHaveText(/2 recipes/);
  await expect(page).toHaveURL(/meal=main/);
  await expect(page).toHaveURL(/max=45/);
  await page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: 'Remove Tonight' }).click();
  await expect(count(page)).toHaveText(/6 recipes/);
});

test('sort sits with the results', async ({ page }) => {
  await page.getByLabel('Sort by').selectOption('fastest');
  await expect(cards(page).first()).toContainText('Lemony Quinoa Salad');
  await expect(page).toHaveURL(/sort=fastest/);
});

test('an empty result names the filter to remove', async ({ page }) => {
  await page.getByRole('searchbox').fill('lentil');
  await page.getByRole('button', { name: 'Desserts', exact: true }).click();
  await page.getByRole('button', { name: /Remove “Desserts”/ }).click();
  await expect(cards(page)).toHaveText([/Red Lentil Soup/]);
});

test('the count credits the blogs and the credits stay on screen', async ({ page }) => {
  await expect(page.getByText(/6 recipes from \d+ vegan blogs/)).toBeVisible();
  await page.getByRole('searchbox').fill('nothing matches this');
  await expect(page.getByText(/^Recipes from \d+ vegan blogs/)).toBeInViewport();
});

test('Pick for me opens one of the matches, and Another draws a different one', async ({ page }) => {
  await page.getByRole('button', { name: 'Soups', exact: true }).click();
  await page.getByRole('button', { name: 'Pick for me' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Red Lentil Soup' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: 'Remove Soups' }).click();
  await page.getByRole('button', { name: 'Pick for me' }).click();
  const first = await sheet.getByRole('heading', { level: 2 }).textContent();
  await sheet.getByRole('button', { name: 'Another' }).click();
  await expect(sheet.getByRole('heading', { level: 2 })).not.toHaveText(first!);
});

test("a recipe's blog opens that blog's shelf, with a way to its site", async ({ page }) => {
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^ElaVegan/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'ElaVegan' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Visit elavegan\.com/ })).toBeVisible();
  await expect(cards(page)).toHaveText([/Red Lentil Soup/]);
  await expect(page).toHaveURL(/from=elavegan/);

  await page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: 'Remove From ElaVegan' }).click();
  await expect(count(page)).toHaveText(/6 recipes/);
});
