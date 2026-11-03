import { expect, fixtureData, test } from './fixtures';

const openFromSearch = async (page: import('@playwright/test').Page, path: string, title: string) => {
  await page.goto(path);
  await page.getByRole('searchbox').fill('pancake');
  await page.getByRole('button', { name: title, exact: true }).click();
  return page.getByRole('dialog');
};

test('Share hands the native sheet the title and a link with only the recipe', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shared: ShareData[] }).shared = [];
    navigator.share = async (data) => { (window as unknown as { shared: ShareData[] }).shared.push(data!); };
  });
  const sheet = await openFromSearch(page, '/', 'Fluffy Vegan Pancakes');
  expect(new URL(page.url()).searchParams.get('q')).toBe('pancake');
  await sheet.getByRole('button', { name: 'Share' }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData[] }).shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]!.title).toBe('Fluffy Vegan Pancakes');
  const url = new URL(shared[0]!.url!);
  expect(url.pathname).toBe('/');
  expect([...url.searchParams.keys()]).toEqual(['r']);
  await expect(sheet.getByRole('status')).toBeEmpty();
});

test('cancelling the native share sheet says nothing', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.share = async () => { throw new DOMException('cancelled', 'AbortError'); };
  });
  const sheet = await openFromSearch(page, '/', 'Fluffy Vegan Pancakes');
  await sheet.getByRole('button', { name: 'Share' }).click();
  await expect(sheet.getByRole('status')).toBeEmpty();
  await expect(sheet.getByRole('textbox')).toHaveCount(0);
});

for (const { path, title } of [{ path: '/', title: 'Fluffy Vegan Pancakes' }, { path: '/it/', title: 'Pancake vegani soffici' }]) {
  test(`without a share sheet the link is copied, and opens the recipe on ${path}`, async ({ page, context, browser }) => {
    await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const sheet = await openFromSearch(page, path, title);
    await sheet.getByRole('button', { name: path === '/' ? 'Share' : 'Condividi' }).click();
    await expect(sheet.getByRole('status')).toHaveText(path === '/' ? 'Link copied' : 'Link copiato');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(link);
    expect(url.pathname).toBe(path);
    expect([...url.searchParams.keys()]).toEqual(['r']);

    // A fresh browser, nothing saved: the same recipe in the same language.
    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.route('**/data/**', fixtureData);
    await other.goto(link);
    await expect(other.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
    await fresh.close();
  });
}

test('when copying fails too, the link is shown to copy by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined });
    Object.defineProperty(Navigator.prototype, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  const sheet = await openFromSearch(page, '/', 'Fluffy Vegan Pancakes');
  await sheet.getByRole('button', { name: 'Share' }).click();
  const field = sheet.getByRole('textbox', { name: 'Link to this recipe' });
  await expect(field).toBeFocused();
  expect([...new URL(await field.inputValue()).searchParams.keys()]).toEqual(['r']);
});
