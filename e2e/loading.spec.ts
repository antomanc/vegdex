import { expect, test } from './fixtures';

// Holds catalog.json back until released, to see the page as a slow connection does.
async function holdCatalog(page: import('@playwright/test').Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/data/catalog.json', async (route) => {
    await held;
    await route.fallback();
  });
  return release;
}

test('a plain landing shows the best-rated recipes while the catalog loads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const release = await holdCatalog(page);
  await page.goto('/');
  const first = page.getByTestId('first-page').getByTestId('recipe-card');
  await expect(first.first()).toBeVisible();
  await expect(page.getByTestId('result-count')).toHaveCount(0);
  // A recipe from the first page opens before the catalog arrives.
  await first.first().getByRole('button').first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { level: 2 })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  const top = () => page.getByTestId('recipe-card').first().evaluate((card) => Math.round(card.getBoundingClientRect().top));
  const before = await top();
  release();
  await expect(page.getByTestId('result-count')).toHaveText('6 recipes');
  await expect(page.getByTestId('first-page')).toHaveCount(0);
  // The count line had its place kept: the cards do not jump when the catalog arrives.
  expect(await top()).toBe(before);
  expect(errors).toEqual([]);
});

test('a filtered link waits for the catalog instead of showing recipes the filters would hide', async ({ page }) => {
  const release = await holdCatalog(page);
  await page.goto('/?q=lentil');
  await expect(page.getByText('Loading recipes…', { exact: true })).toBeAttached();
  await expect(page.getByTestId('first-page')).toHaveCount(0);
  release();
  await expect(page.getByTestId('recipe-card')).toHaveText([/Red Lentil Soup/]);
});

test('typing while the catalog loads searches it once it arrives', async ({ page }) => {
  const release = await holdCatalog(page);
  await page.goto('/');
  await expect(page.getByTestId('first-page')).toBeVisible();
  await page.getByRole('searchbox').fill('brownies');
  await expect(page.getByTestId('first-page')).toHaveCount(0);
  release();
  await expect(page.getByTestId('recipe-card')).toHaveText([/Fudgy Vegan Brownies/]);
});

test('a catalog the worker cannot read shows the load error, and trying again recovers', async ({ page }) => {
  let corrupt = true;
  await page.route('**/data/catalog.json', (route) => (corrupt ? route.fulfill({ body: '{"version":2,"recipes":[', contentType: 'application/json' }) : route.fallback()));
  await page.goto('/?q=lentil');
  await expect(page.getByText("Couldn't load the recipes. Check your connection and try again.", { exact: true })).toBeVisible();
  corrupt = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('recipe-card')).toHaveText([/Red Lentil Soup/]);
});
