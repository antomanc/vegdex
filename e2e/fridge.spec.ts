import { expect, test } from './fixtures';

const cards = (page: import('@playwright/test').Page) => page.getByTestId('recipe-card');

test('My fridge shows what the cook can make, closest to ready first, and remembers what is in it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  await page.getByRole('button', { name: 'My fridge', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'What’s in your fridge?' });
  for (const name of ['tofu', 'spinach', 'onion', 'garlic']) await sheet.getByRole('button', { name, exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'tofu', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sheet.getByRole('button', { name: /Cook from it: \d+ recipes?/ }).click();

  await expect(page).toHaveURL(/fridge=1/);
  await expect(page.getByTestId('result-count')).toHaveText(/recipes? from your fridge/);
  await expect(page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: 'Remove From my fridge' })).toBeVisible();
  // The curry uses four of the four things in the fridge; the brownies use none.
  await expect(cards(page).first()).toContainText('Spinach Tofu Curry');
  await expect(cards(page).first().getByTestId('fridge-fit')).toHaveText(/To buy: |You have everything/);
  await expect(cards(page).filter({ hasText: 'Fudgy Vegan Brownies' })).toHaveCount(0);

  // The fridge stays on this device; the link only says to cook from it.
  await page.reload();
  await expect(cards(page).first()).toContainText('Spinach Tofu Curry');
  await expect(page.getByRole('button', { name: 'My fridge', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: 'Remove From my fridge' }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  await expect(page.getByTestId('fridge-fit')).toHaveCount(0);
});

test('a name typed into the fridge goes in when the sheet closes, and Empty the fridge takes everything out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My fridge', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'What’s in your fridge?' });
  await sheet.getByRole('combobox').fill('cornstarch');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Remove cornstarch' })).toBeVisible();
  // A quick chip shows its own state instead of a second chip.
  await sheet.getByRole('button', { name: 'tofu', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'tofu', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('button', { name: 'Remove tofu' })).toHaveCount(0);
  await sheet.getByRole('combobox').fill('cumin');
  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'My fridge', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Remove cumin' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Empty the fridge' }).click();
  await expect(sheet.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'tofu', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet.getByRole('button', { name: 'Show what I can cook' })).toBeDisabled();
});
