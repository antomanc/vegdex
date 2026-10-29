import type { Catalog } from '@vegdex/core';
import fs from 'node:fs';
import { expect, italianFixtureData, test } from './fixtures';

// Keep every ranking factor equal so only the page's language decides the order.
const catalog = JSON.parse(fs.readFileSync(new URL('./fixtures/italian-data/catalog.json', import.meta.url), 'utf8')) as Catalog;
const italian = catalog.recipes.find((r) => r.id === 'italian-chickpeas')!;
const english = catalog.recipes.find((r) => r.id === 'quinoa-salad')!;
const equivalent = { ...catalog, recipes: [english, { ...italian, rating: english.rating, ratingCount: english.ratingCount, minutes: english.minutes }] };

test('Italian page prefers equivalent Italian content and the English page prefers English content', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/**', italianFixtureData);
  await page.route('**/data/catalog.json', (route) => route.fulfill({ json: equivalent }));
  await page.goto('/it/');
  const cards = page.getByTestId('recipe-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Insalata italiana di ceci');
  await page.goto('/');
  await expect(cards.first()).toContainText('Lemony Quinoa Salad');
  expect(errors).toEqual([]);
});

test('Italian content preference preserves ratings, explicit fastest order and ingredient filters', async ({ page }) => {
  await page.route('**/data/**', italianFixtureData);
  const cards = page.getByTestId('recipe-card');
  await page.goto('/it/?meal=salad');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Insalata di quinoa al limone');
  await page.goto('/it/?meal=salad&sort=fastest');
  await expect(cards.first()).toContainText('Insalata di quinoa al limone');
  await page.goto('/it/?meal=salad&have=ceci&avoid=quinoa');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Insalata italiana di ceci');
});
