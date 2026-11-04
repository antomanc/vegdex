import { expect, test } from './fixtures';

test('header language switch preserves the active search and saved recipes', async ({ page }) => {
  await page.goto('/?q=lentil');
  await expect(page.getByTestId('result-count')).toHaveText('1 recipe');
  await page.getByRole('button', { name: 'Save Red Lentil Soup', exact: true }).click();
  await page.locator('header').getByRole('link', { name: 'Switch to Italiano', exact: true }).click();
  await expect(page).toHaveURL('/it/?q=lentil');
  await expect(page.getByRole('searchbox')).toHaveValue('lentil');
  await expect(page.getByRole('button', { name: 'Salvate · 1', exact: true })).toBeVisible();
  await expect(page.getByTestId('result-count')).toHaveText('1 ricetta');
  await page.locator('header').getByRole('link', { name: 'Cambia lingua: English', exact: true }).click();
  await expect(page).toHaveURL('/?q=lentil');
});

test('the docked Filters button returns to the header without changing the results', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  const back = page.getByRole('button', { name: 'Filters', exact: true });
  await expect(back).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 850));
  await expect(back).toBeVisible();
  // One way back, on the same line as Pick for me.
  const pick = page.getByRole('button', { name: 'Pick for me', exact: true });
  const [a, b] = [await back.boundingBox(), await pick.boundingBox()];
  expect(a!.y).toBe(b!.y);
  expect(a!.height).toBe(b!.height);
  await expect(page.getByRole('button', { name: 'Back to top', exact: true })).toHaveCount(0);
  await back.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'vegdex, all recipes', exact: true })).toBeFocused();
  await expect(page.getByTestId('recipe-card')).toHaveCount(6);
});
