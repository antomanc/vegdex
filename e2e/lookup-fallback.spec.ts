import { expect, test } from './fixtures';

const cards = (page: import('@playwright/test').Page) => page.getByTestId('recipe-card');
const CHECKED = 'vegdex:grocery-checked';
// Rendered checkboxes store their unticked state too; only ticks matter here.
const ticks = (page: import('@playwright/test').Page) =>
  page.evaluate((key) => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(key)!)).filter(([, on]) => on)), CHECKED);

test('a failed ingredient lookup keeps the catalog and English name search', async ({ page }) => {
  await page.route('**/data/lookup/**', (route) => route.abort());
  await page.goto('/it/?q=chickpeas');
  await expect(cards(page)).toHaveText([/Insalata di quinoa al limone/]);
  await expect(page.getByText('Non riesco a caricare le ricette', { exact: false })).toHaveCount(0);
  await page.getByRole('searchbox').fill('');
  await expect(page.getByTestId('result-count')).toHaveText('6 ricette');
});

test('a failed catalog still shows the load error', async ({ page }) => {
  await page.route('**/data/catalog.json', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByText("Couldn't load the recipes. Check your connection and try again.", { exact: true })).toBeVisible();
});

async function openList(page: import('@playwright/test').Page, checked: Record<string, boolean>, ids = ['pancakes', 'brownies'], beforeOpen = async () => {}) {
  await page.goto('/');
  await page.evaluate(([key, value, saved]) => {
    localStorage.setItem('vegdex:saved', saved);
    localStorage.setItem(key, value);
  }, [CHECKED, JSON.stringify(checked), JSON.stringify(ids)] as const);
  await page.reload();
  await page.getByRole('button', { name: `Saved · ${ids.length}`, exact: true }).click();
  await beforeOpen();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  return page.getByRole('dialog').getByTestId('grocery-list');
}

test('ticks stored by name before concepts move to the merged rows', async ({ page }) => {
  // "corn starch" was the brownies' own row; both recipes now share the cornstarch row.
  const list = await openList(page, { 'corn starch': true, sugar: true, 'gone from the list': true });
  await expect(list.locator('li', { hasText: 'cornstarch' }).getByRole('checkbox')).toBeChecked();
  await expect(list.locator('li', { has: page.getByText('sugar', { exact: true }) }).getByRole('checkbox')).toBeChecked();
  await expect.poll(() => ticks(page)).toEqual({
    'baking & sweeteners/cornstarch': true,
    'baking & sweeteners/sugar': true
  });
});

for (const offline of [false, true]) test(`ticks survive a shopping list opened without the English lookup${offline ? ' offline' : ''}`, async ({ page, context }) => {
  // The concept row is "cornstarch"; going by name alone, the brownies' row would be "corn starch".
  const stored = { 'baking & sweeteners/cornstarch': true };
  await page.route('**/data/lookup/**', (route) => route.abort());
  const list = await openList(page, stored, ['brownies'], () => context.setOffline(offline));
  await expect(list.locator('li', { hasText: 'corn starch' })).toBeVisible();
  await expect(list.first()).toBeVisible();
  await page.waitForTimeout(300);
  expect(await ticks(page)).toEqual(stored);
  await context.setOffline(false);
  await page.unroute('**/data/lookup/**');
  // The open list is part of the URL, so it comes back after the reload.
  await page.reload();
  await expect(page.getByRole('dialog').getByTestId('grocery-list').locator('li', { hasText: 'cornstarch' }).getByRole('checkbox')).toBeChecked();
});
