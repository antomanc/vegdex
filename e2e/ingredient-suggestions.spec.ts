import { expect, test } from './fixtures';

test('Must include and Avoid suggest known ingredients as you type; picking one adds it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByRole('combobox', { name: 'Must include' });
  const avoid = page.getByRole('combobox', { name: 'Avoid' });

  await have.pressSequentially('lent');
  await page.getByRole('dialog').getByRole('option', { name: 'red lentil' }).click();
  await expect(page.getByRole('button', { name: 'Remove red lentil' })).toBeVisible();
  await expect(have).toHaveValue('');
  await expect(have).toBeFocused();
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe/);

  // An ingredient already chosen is not offered again, on either side.
  await avoid.pressSequentially('lent');
  await expect(page.getByRole('dialog').getByRole('option', { name: 'red lentil' })).toHaveCount(0);
  await avoid.fill('coco');
  await expect(page.getByRole('dialog').getByRole('option', { name: 'coconut milk' })).toBeVisible();
});

test('typing a name the list does not know still adds it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByRole('combobox', { name: 'Must include' });
  await have.fill('lent');
  await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  await have.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove lent' })).toBeVisible();
});

test('shows a handful of matches, prefix first, and typing reaches any name', async ({ page }) => {
  const names = Array.from({ length: 400 }, (_, i) => `ingredient ${i}`);
  names.push('saffron', 'black salt', 'salt');
  await page.route('**/data/suggest/*.json', (route) => route.fulfill({ json: names }));
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByRole('combobox', { name: 'Must include' });

  await have.focus();
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(0);
  await have.fill('ingredient');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(5);
  await have.fill('saff');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveText(['saffron']);
  await have.fill('salt');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveText(['salt', 'black salt']);
});

test('the keyboard walks the list, Enter picks, and Escape closes it without closing the sheet', async ({ page }) => {
  await page.route('**/data/suggest/*.json', (route) => route.fulfill({ json: ['tofu', 'tomato', 'tempeh'] }));
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByRole('combobox', { name: 'Must include' });

  await have.fill('to');
  // The arrows only walk a list that has arrived.
  await expect(page.getByRole('dialog').getByRole('option', { name: 'tomato' })).toBeVisible();
  await have.press('ArrowDown');
  await have.press('ArrowDown');
  await expect(page.getByRole('dialog').getByRole('option', { name: 'tomato' })).toHaveAttribute('aria-selected', 'true');
  await have.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove tomato' })).toBeVisible();

  await have.fill('to');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveText(['tofu']);
  await have.press('Escape');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a comma list suggests for the last ingredient and keeps the earlier ones', async ({ page }) => {
  await page.route('**/data/suggest/*.json', (route) => route.fulfill({ json: ['tofu', 'spinach'] }));
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByRole('combobox', { name: 'Must include' });
  await have.focus();
  await have.fill('tofu, spi');
  await page.getByRole('dialog').getByRole('option', { name: 'spinach' }).click();
  await expect(page.getByRole('button', { name: 'Remove tofu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove spinach' })).toBeVisible();
});

test('matching ignores case, and a mixed-case name can still be picked', async ({ page }) => {
  // Real suggestions keep their case: "Old Bay", "senape di Digione", "lenticchie di Puy".
  await page.route('**/data/suggest/*.json', (route) => route.fulfill({ json: ['aglio', 'senape di Digione'] }));
  await page.goto('/it/');
  await page.getByRole('button', { name: /Altri filtri/ }).click();
  const have = page.getByRole('combobox', { name: 'Deve contenere' });

  await have.focus();
  await have.fill('digione');
  await page.getByRole('dialog').getByRole('option', { name: 'senape di Digione' }).click();
  await expect(page.getByRole('button', { name: 'Rimuovi senape di digione' })).toBeVisible();
  // Already chosen, so no longer offered: the two sides compare in the same case.
  await have.fill('digione');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(0);
});

test('suggestions follow the page language', async ({ page }) => {
  await page.goto('/it/');
  await page.getByRole('button', { name: /Altri filtri/ }).click();
  const have = page.getByRole('combobox', { name: 'Deve contenere' });
  await have.focus();
  await have.fill('lenticchie');
  await expect(page.getByRole('dialog').getByRole('option', { name: 'lenticchie rosse' })).toBeVisible();
  await have.fill('red lentil');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(0);
});
