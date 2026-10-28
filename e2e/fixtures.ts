import { test as base, expect, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(import.meta.dirname, 'fixtures/data');

export const fixtureData = (route: Route) => {
  const rel = new URL(route.request().url()).pathname.split('/data/')[1] ?? '';
  const file = path.join(dataDir, rel);
  if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
  return route.fulfill({ path: file, contentType: 'application/json' });
};

/** Every test sees the small fixture dataset instead of whatever was last crawled. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/data/**', fixtureData);
    await use(page);
  }
});

export { expect };
