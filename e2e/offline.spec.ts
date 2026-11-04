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
