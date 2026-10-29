import { expect, test } from './fixtures';

test('Italian search finds the displayed title and keeps original-title and ingredient matching', async ({ page }) => {
  await page.goto('/it/?q=quinoa');
  const card = page.getByTestId('recipe-card');
  await expect(card).toHaveText(/Insalata di quinoa al limone/);
  await page.getByRole('searchbox').fill('Insalata di quinoa al limone');
  await expect(card).toHaveText(/Insalata di quinoa al limone/);
  await page.getByRole('searchbox').fill('Lemony Quinoa Salad');
  await expect(card).toHaveText(/Insalata di quinoa al limone/);
  await page.goto('/it/?q=Insalata%20di%20quinoa%20al%20limone&have=ceci&avoid=funghi');
  await expect(card).toHaveText(/Insalata di quinoa al limone/);
  await page.goto('/it/?q=Insalata%20di%20quinoa%20al%20limone&avoid=ceci');
  await expect(card).toHaveCount(0);
});

test('a translated-title search offers the filter removal that brings the recipe back', async ({ page }) => {
  await page.goto('/it/?q=Insalata%20di%20quinoa%20al%20limone&meal=dessert');
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await page.getByRole('button', { name: /Togli “Dolci”/ }).click();
  await expect(page.getByTestId('recipe-card')).toHaveText(/Insalata di quinoa al limone/);
});

test('Italian titles preserve source titles and appear in saved recipes and the shopping list', async ({ page }) => {
  await page.goto('/it/?q=pancakes');
  await expect(page.getByRole('button', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salva Pancake vegani soffici', exact: true }).click();
  await page.getByRole('button', { name: 'Pancake vegani soffici', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await expect(sheet.getByText('Fluffy Vegan Pancakes', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Cucina la ricetta su/ })).toHaveAttribute('href', 'https://example.com/pancakes/');
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: /Salvate/ }).first().click();
  await expect(page.getByRole('button', { name: 'Pancake vegani soffici', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Lista della spesa/ }).click();
  await page.getByRole('dialog').locator('summary').click();
  await expect(page.getByRole('dialog').getByText('Pancake vegani soffici', { exact: true })).toBeVisible();
});

for (const unsafe of ['Pancake al burro', 'Pasta al cheddar', 'Pasta al gorgonzola']) {
  test(`unsafe title ${unsafe} falls back to originals at display time`, async ({ page }) => {
    await page.route('**/data/overlay/it.json', (route) => route.fulfill({ json: {
      language: 'it', titles: { 'Fluffy Vegan Pancakes': unsafe }
    } }));
    await page.goto('/it/?q=pancakes');
    await expect(page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
    await expect(page.getByText(unsafe, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await page.getByRole('searchbox').fill(unsafe);
    await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  });
}

test('unavailable overlays keep the catalog browsable and missing titles retain originals', async ({ page }) => {
  await page.route('**/data/overlay/it.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('/it/?q=pancakes');
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fluffy Vegan Pancakes', exact: true })).toBeVisible();
  await page.goto('/it/?q=spinach');
  await expect(page.getByRole('button', { name: 'Spinach Tofu Curry', exact: true })).toBeVisible();
});
