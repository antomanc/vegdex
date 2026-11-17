import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
});

test('Pick for me deals the matches as a deck: save keeps one and deals the next, and the end offers a reshuffle', async ({ page }) => {
  await page.getByRole('button', { name: 'Soups', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/1 recipe/);
  await page.getByRole('button', { name: 'Pick for me' }).click();
  const deck = page.getByRole('dialog');
  await expect(deck.getByRole('heading', { name: 'Red Lentil Soup', level: 3 })).toBeVisible();
  await deck.getByRole('button', { name: 'Save and next' }).click();
  await expect(deck.getByText('1 saved')).toBeVisible();
  await expect(deck.getByText('That’s the stall')).toBeVisible();
  await deck.getByRole('button', { name: 'Shuffle again' }).click();
  await expect(deck.getByRole('heading', { name: 'Red Lentil Soup', level: 3 })).toBeVisible();
  await deck.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Saved · 1' })).toBeVisible();
});

test('a card swiped right is saved, one swiped left is skipped, and a tap opens the recipe over the deck', async ({ page }) => {
  await page.getByRole('button', { name: 'Pick for me' }).click();
  const deck = page.getByRole('dialog');
  const card = deck.getByRole('heading', { level: 3 });
  const swipe = async (dx: number) => {
    const box = (await deck.locator('.deck-top').boundingBox())!;
    const y = box.y + box.height / 3;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step++) await page.mouse.move(box.x + box.width / 2 + (dx * step) / 6, y);
    await page.mouse.up();
  };

  const first = (await card.textContent())!;
  await swipe(260);
  await expect(card).not.toHaveText(first);
  await expect(deck.getByText('1 saved')).toBeVisible();
  const second = (await card.textContent())!;
  await swipe(-260);
  await expect(card).not.toHaveText(second);
  await expect(deck.getByText('1 saved')).toBeVisible();

  const third = (await card.textContent())!;
  await deck.getByRole('button', { name: `Open ${third}` }).click();
  const recipe = page.getByRole('dialog', { name: third });
  await expect(recipe.getByRole('link', { name: /Cook it on/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(recipe).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Pick for me' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Saved · 1' }).click();
  await expect(page.getByTestId('recipe-card')).toHaveText([new RegExp(first)]);
});
