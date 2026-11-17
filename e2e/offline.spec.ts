// Runs in the "offline" project: service workers allowed, fixtures served by e2e/offline-server.ts.
import { expect, test } from '@playwright/test';

test('after one visit the grid and an opened recipe work offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText('6 recipes');
  await page.getByRole('searchbox').fill('pancake');
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('listitem').first()).toBeVisible();
  // Going offline is only fair once the service worker has cached every data file this visit loaded.
  await expect.poll(() => page.evaluate(async () => {
    const files = [...new Set(performance.getEntriesByType('resource').map((e) => e.name).filter((url) => url.includes('/data/')))];
    const cached = await Promise.all(files.map((url) => caches.match(url)));
    return files.length ? files.filter((_, i) => !cached[i]) : ['nothing loaded from /data/'];
  })).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Fluffy Vegan Pancakes');
  await expect(sheet.getByRole('listitem').first()).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('searchbox').fill('');
  await expect(page.getByTestId('result-count')).toHaveText('6 recipes');
  await expect(page.getByTestId('recipe-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('an opened recipe shows its current lines, not a shard cached by an older visit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('pancake');
  await page.getByRole('button', { name: 'Fluffy Vegan Pancakes', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('ingredients').getByRole('listitem').first()).toBeVisible();
  const shard = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((url) => url.includes('/data/details/')));
  // A visit weeks ago left this shard in the cache with lines the dataset no longer has.
  await expect.poll(() => page.evaluate(async (url) => {
    const cache = await caches.open('vegdex-data');
    const cached = await cache.match(url!);
    if (!cached) return false;
    const old = Object.fromEntries(Object.keys(await cached.json()).map((id) => [id, ['1 cup stale line']]));
    await cache.put(url!, new Response(JSON.stringify(old), { headers: { 'content-type': 'application/json' } }));
    return true;
  }, shard)).toBe(true);

  await page.reload();
  await expect(sheet.getByTestId('ingredients').getByRole('listitem').first()).toBeVisible();
  await expect(sheet.getByTestId('ingredients')).not.toContainText('stale line');
});

test('a version that takes over while the installed app waits in the background loads when the cook comes back, never over an open sheet', async ({ page }) => {
  await page.goto('/');
  // The app checks for updates only once a worker already controls the page, as on an installed app.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.reload();
  await expect(page.getByTestId('result-count')).toHaveText('6 recipes');
  const comeBack = () => page.evaluate(() => {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  const marked = () => page.evaluate(() => (window as unknown as { oldPage?: boolean }).oldPage === true);
  await page.evaluate(() => {
    (window as unknown as { oldPage?: boolean }).oldPage = true;
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });

  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await comeBack();
  expect(await marked()).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await Promise.all([page.waitForEvent('load'), comeBack()]);
  expect(await marked()).toBe(false);
  await expect(page.getByTestId('result-count')).toHaveText('6 recipes');
});
