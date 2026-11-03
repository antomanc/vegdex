import { expect, test } from './fixtures';

const openList = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save Spinach Tofu Curry' }).click();
  await page.getByRole('button', { name: 'Save Red Lentil Soup' }).click();
  await page.getByRole('button', { name: /Saved · 2/ }).click();
  await page.getByRole('button', { name: 'Shopping list' }).click();
  return page.getByRole('dialog');
};

// Garlic is the one item both recipes need: 3 + 2 cloves.
const listText = (garlic: boolean) => [
  'Shopping list',
  '',
  'Produce',
  '- Chipotle peppers in adobo sauce: 1 ½ tbsp',
  ...(garlic ? ['- Garlic: 5 cloves'] : []),
  '- Onion: 2',
  '- Spinach: 4 cups (960 ml)',
  '',
  'Tofu & alternatives',
  '- Tofu: 1 block',
  '',
  'Beans & legumes',
  '- Red lentil: 1 cup (240 ml)',
  '',
  'Canned & jarred',
  '- Coconut milk: 1 can',
  '',
  'Oils, vinegars & sauces',
  '- Vegetable broth: 4 cups (960 ml)',
  '',
  'Spices',
  '- Cumin: 1 tsp',
  '- Curry powder: 1 tbsp',
  '- Salt: to taste',
  '',
  'Baking & sweeteners',
  '- Cornstarch: 1 tbsp',
  '',
  'Other',
  '- Water: ½ cup (120 ml)',
  '',
  'For these recipes:',
  '- Red Lentil Soup',
  '- Spinach Tofu Curry'
].join('\n');

test('Copy list puts what is left to buy on the clipboard, aisle by aisle', async ({ page, context }) => {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const list = await openList(page);
  await list.getByTestId('grocery-list').locator('label', { hasText: 'garlic' }).click();
  await list.getByRole('button', { name: 'Copy list' }).click();
  await expect(list.getByRole('status')).toHaveText('List copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(listText(false));
});

test('Share list hands the native sheet the same text', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shared: ShareData[] }).shared = [];
    navigator.share = async (data) => { (window as unknown as { shared: ShareData[] }).shared.push(data!); };
  });
  const list = await openList(page);
  await list.getByRole('button', { name: 'Share list' }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData[] }).shared);
  expect(shared).toEqual([{ text: listText(true) }]);
  await expect(list.getByRole('status')).toBeEmpty();
});

test('a recipe left out of this trip stays out of the copied list, in the page language', async ({ page, context }) => {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/it/');
  await page.getByRole('button', { name: 'Salva Pancake vegani soffici', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Brownies vegani fondenti', exact: true }).click();
  await page.getByRole('button', { name: 'Salvate · 2', exact: true }).click();
  await page.getByRole('button', { name: 'Lista della spesa', exact: true }).click();
  const list = page.getByRole('dialog');
  await list.locator('summary').click();
  await list.getByRole('checkbox', { name: /Brownies vegani fondenti/ }).uncheck();
  await list.getByRole('button', { name: 'Copia lista' }).click();
  await expect(list.getByRole('status')).toHaveText('Lista copiata');

  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.startsWith('Lista della spesa\n\n')).toBe(true);
  expect(text).toContain('\nPasticceria e dolcificanti\n');
  expect(text.endsWith('\n\nPer queste ricette:\n- Pancake vegani soffici')).toBe(true);
  expect(text).not.toContain('Brownies');
  // The brownies' cocoa is not on this trip.
  expect(text).not.toMatch(/cacao/i);
});
