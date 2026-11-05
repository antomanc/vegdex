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
