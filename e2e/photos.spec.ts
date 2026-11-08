import { expect, test } from './fixtures';

test('a blog sees vegdex asking for a photo and can refuse it', async ({ page }) => {
  let referer: string | undefined;
  await page.route('https://example.com/lentil-soup.jpg', async (route) => {
    referer = (await route.request().allHeaders()).referer;
    await route.fulfill({ status: 403 });
  });
  await page.goto('/?q=Red%20Lentil%20Soup');
  const card = page.getByTestId('recipe-card').first();
  await expect(card.locator('.placeholder')).toBeVisible();
  await expect(card.locator('img')).toHaveCount(0);
  expect(referer).toBe('http://localhost:4174/');
});

test('a portrait photo stays inside its square, so the row keeps its height', async ({ page }) => {
  await page.route('https://example.com/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="550" height="758"><rect width="550" height="758" fill="#c84"/></svg>'
  }));
  await page.goto('/');
  const thumbs = page.getByTestId('recipe-card').locator('.thumb');
  // A portrait has to have loaded, or a square crate proves nothing.
  await expect.poll(() => thumbs.evaluateAll((all) => all.some((t) => {
    const img = t.querySelector('img');
    return !!img?.complete && img.naturalHeight > img.naturalWidth;
  }))).toBe(true);
  expect(await thumbs.evaluateAll((all) => all.filter((t) => Math.abs(t.clientHeight - t.clientWidth) > 1).length)).toBe(0);
});
