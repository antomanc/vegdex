import { expect, test } from './fixtures';

test('footer language links keep filters and the saved view, including changes made after load', async ({ page }) => {
  await page.goto('/?meal=dessert&max=30&free=gluten&view=saved');
  const italian = page.locator('footer').getByRole('link', { name: 'Italiano', exact: true });
  await expect(italian).toHaveAttribute('href', '/it/?meal=dessert&max=30&free=gluten&view=saved');
  await italian.click();
  await expect(page).toHaveURL('/it/?meal=dessert&max=30&free=gluten&view=saved');
  await expect(page.getByRole('heading', { name: 'Ricette salvate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'vegdex, tutte le ricette', exact: true }).click();
  await page.getByRole('button', { name: 'Dolci', exact: true }).click();
  await page.getByRole('searchbox').fill('soup');
  const english = page.locator('footer').getByRole('link', { name: 'English', exact: true });
  await expect(english).toHaveAttribute('href', '/?q=soup&max=30&free=gluten');
  await english.click();
  await expect(page).toHaveURL('/?q=soup&max=30&free=gluten');
  await expect(page.getByRole('searchbox')).toHaveValue('soup');
});

test.describe('an Italian browser on the English page', () => {
  test.use({ locale: 'it-IT' });

  test('offers Italian without redirecting and remembers a dismissal', async ({ page }) => {
    await page.goto('/?meal=soup&max=60');
    await expect(page.getByTestId('result-count')).toHaveText('1 recipe');
    await expect(page).toHaveURL('/?meal=soup&max=60');
    const suggestion = page.getByRole('link', { name: 'Disponibile in italiano', exact: true });
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toHaveAttribute('href', '/it/?meal=soup&max=60');
    await page.getByRole('button', { name: 'Dismiss language suggestion', exact: true }).click();
    await expect(suggestion).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('result-count')).toHaveText('1 recipe');
    await expect(suggestion).toHaveCount(0);
    // The permanent footer link stays available after dismissal.
    await page.locator('footer').getByRole('link', { name: 'Italiano', exact: true }).click();
    await expect(page).toHaveURL('/it/?meal=soup&max=60');
    await expect(suggestion).toHaveCount(0);
    await page.locator('footer').getByRole('link', { name: 'English', exact: true }).click();
    await expect(page.getByTestId('result-count')).toHaveText('1 recipe');
    await expect(suggestion).toHaveCount(0);
  });

  test('the suggestion opens the same filters in Italian', async ({ page }) => {
    await page.goto('/?meal=dessert');
    await page.getByRole('link', { name: 'Disponibile in italiano', exact: true }).click();
    await expect(page).toHaveURL('/it/?meal=dessert');
    await expect(page.getByRole('button', { name: 'Dolci', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Disponibile in italiano', exact: true })).toHaveCount(0);
  });
});

for (const locale of ['en-US', 'en-GB', 'fr-FR', 'de-DE']) {
  test.describe(`a ${locale} browser`, () => {
    test.use({ locale });

    test('stays in the requested language without an Italian suggestion', async ({ page }) => {
      for (const path of ['/', '/it/']) {
        await page.goto(path);
        await expect(page.getByTestId('recipe-card')).toHaveCount(6);
        await expect(page).toHaveURL(path);
        await expect(page.getByRole('link', { name: 'Disponibile in italiano', exact: true })).toHaveCount(0);
      }
    });
  });
}

test('saved recipes, shopping amounts and check-offs survive switching languages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry', exact: true }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup', exact: true }).click();
  await page.getByRole('button', { name: 'Saved · 2', exact: true }).click();
  await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
  const list = page.getByRole('dialog');
  await list.getByRole('button', { name: 'Metric', exact: true }).click();
  await list.getByText('For 2 saved recipes', { exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await list.getByRole('button', { name: 'More servings of Spinach Tofu Curry', exact: true }).click();
  }
  await list.getByRole('button', { name: 'More servings of Red Lentil Soup', exact: true }).click();
  const groceries = list.getByTestId('grocery-list');
  await expect(groceries.locator('li', { hasText: 'garlic' })).toContainText('9 cloves');
  await groceries.getByRole('checkbox', { name: /garlic/ }).check();
  await list.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('footer').getByRole('link', { name: 'Italiano', exact: true }).click();
  await expect(page).toHaveURL('/it/?view=saved');
  await expect(page.getByTestId('result-count')).toHaveText('2 ricette salvate');
  await expect(page.getByTestId('recipe-card')).toHaveText([/Spinach Tofu Curry/, /Red Lentil Soup/]);
  await page.getByRole('button', { name: 'Lista della spesa', exact: true }).click();
  await expect(list.getByText('Per 2 ricette salvate · 2 modificate', { exact: true })).toBeVisible();
  await list.locator('summary').click();
  await expect(list.getByText('8 porzioni', { exact: true })).toBeVisible();
  await expect(list.getByText('×1½', { exact: true })).toBeVisible();
  await expect(groceries.locator('li', { hasText: 'garlic' })).toContainText('9 spicchi');
  await expect(groceries.getByRole('checkbox', { name: /garlic/ })).toBeChecked();
  await expect(list.getByRole('button', { name: 'Metriche', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(groceries.locator('li', { hasText: 'garlic' })).toContainText('9 spicchi');
});
