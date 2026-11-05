import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

type CookEvent = { path: string; title: string; event: boolean };

/** Stub GoatCounter before the app loads, and collect the events it would send. */
const stubGoatCounter = async (page: Page) => {
  await page.addInitScript(() => {
    const target = window as Window & { __cookEvents?: CookEvent[]; goatcounter?: { count: (event: CookEvent) => void } };
    target.__cookEvents = [];
    target.goatcounter = { count: (event) => target.__cookEvents!.push(event) };
  });
};

const cookEvents = (page: Page) =>
  page.evaluate(() => (window as Window & { __cookEvents?: CookEvent[] }).__cookEvents ?? []);

/** The creator link opens in a popup; close it so an unrelated tab does not linger. */
const tapCreatorLink = async (page: Page, name: RegExp) => {
  const link = page.getByRole('dialog').getByRole('link', { name });
  const popup = page.waitForEvent('popup');
  await link.click();
  await (await popup).close();
  return link;
};

test('a creator-link tap records one event with the blog and UI language only', async ({ page }) => {
  await stubGoatCounter(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();

  await tapCreatorLink(page, /Cook it on ElaVegan/);

  const events = await cookEvents(page);
  expect(events).toHaveLength(1);
  const event = events[0]!;
  expect(event.path).toBe('cook/elavegan/en');
  expect(event.event).toBe(true);
  // Nothing about the recipe travels: no id, no title, no URL, no filters.
  expect(Object.keys(event).sort()).toEqual(['event', 'path', 'title']);
  expect(JSON.stringify(events)).not.toContain('lentil-soup');
  expect(JSON.stringify(events)).not.toContain('Red Lentil Soup');
});

test('/it/ records the Italian UI language', async ({ page }) => {
  await stubGoatCounter(page);
  await page.goto('/it/');
  await page.getByRole('button', { name: 'Zuppa di lenticchie rosse', exact: true }).click();

  await tapCreatorLink(page, /Cucina su ElaVegan/);

  const events = await cookEvents(page);
  expect(events).toHaveLength(1);
  expect(events[0]!.path).toBe('cook/elavegan/it');
  expect(JSON.stringify(events)).not.toContain('lentil-soup');
});

test('without the script a creator-link tap still opens the blog and raises no page error', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('/');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();

  const link = page.getByRole('dialog').getByRole('link', { name: /Cook it on ElaVegan/ });
  await expect(link).toHaveAttribute('href', 'https://example.com/lentil-soup/');
  await expect(page.getByRole('dialog').getByRole('link', { name: /Cook it on ElaVegan/ })).toBeVisible();

  await tapCreatorLink(page, /Cook it on ElaVegan/);

  expect(errors).toEqual([]);
  expect(await page.evaluate(() => typeof (window as Window & { goatcounter?: unknown }).goatcounter)).toBe('undefined');
});
