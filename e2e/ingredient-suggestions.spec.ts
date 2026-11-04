import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

/** What Chrome does when a datalist option is picked: the value is replaced and a plain input event fires. */
const pick = (input: Locator, value: string) =>
  input.evaluate((el: HTMLInputElement, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

const options = (input: Locator) =>
  input.evaluate((el: HTMLInputElement) => [...(el.list?.options ?? [])].map((o) => o.value));

test('Must include and Avoid suggest known ingredients; picking one adds it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByLabel('Must include');
  const avoid = page.getByLabel('Avoid');

  await have.focus();
  await expect.poll(() => options(have)).toContain('red lentil');
  await have.pressSequentially('lent');
  await pick(have, 'red lentil');
  await expect(page.getByRole('button', { name: 'Remove red lentil' })).toBeVisible();
  await expect(have).toHaveValue('');
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe/);
  // An ingredient already chosen is not offered again.
  expect(await options(have)).not.toContain('red lentil');

  await avoid.focus();
  expect(await options(avoid)).toContain('coconut milk');
  expect(await options(avoid)).not.toContain('red lentil');
});

test('typing a name the list does not know still adds it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByLabel('Must include');
  await have.fill('lent');
  await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  await have.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove lent' })).toBeVisible();
});

test('hands the native datalist a short list, and typing still reaches names further down', async ({ page }) => {
  // A long list: Safari rebuilds its suggestion popup from every option on each keystroke.
  const names = Array.from({ length: 400 }, (_, i) => `ingredient ${i}`)
  names.push('saffron')
  await page.route('**/data/suggest/*.json', (route) => route.fulfill({ json: names }));
  await page.goto('/');
  await page.getByRole('button', { name: /More filters/ }).click();
  const have = page.getByLabel('Must include');

  await have.focus();
  await expect.poll(() => options(have)).toHaveLength(50);
  expect(await options(have)).not.toContain('saffron');

  // A name past the cap is one keystroke away.
  await have.fill('saff');
  await expect.poll(() => options(have)).toEqual(['saffron']);
});

test('suggestions follow the page language', async ({ page }) => {
  await page.goto('/it/');
  await page.getByRole('button', { name: /Altri filtri/ }).click();
  const have = page.getByLabel('Deve contenere');
  await have.focus();
  await expect.poll(() => options(have)).toContain('lenticchie rosse');
  expect(await options(have)).not.toContain('red lentil');
});
