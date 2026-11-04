import { expect, test } from './fixtures';

test('closing remains modal through the exit and repeated dismissal keeps history intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.evaluate((node: HTMLDialogElement) => {
    node.dispatchEvent(new Event('cancel', { cancelable: true }));
    node.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (!node.open || !node.classList.contains('closing')) throw new Error('Exit must retain the modal');
  });
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/r=/);
  await page.getByRole('button', { name: /More filters/ }).click();
  await page.getByRole('button', { name: 'High protein', exact: true }).click();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('recipe-card')).toHaveText([/Spinach Tofu Curry/]);
});

test('reduced motion preserves feedback without spatial sheet or button motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const spatial = await dialog.evaluate((node) => node.getAnimations().some((a) =>
    (a.effect as KeyframeEffect).getKeyframes().some((k) => k.translate || k.rotate || (k.transform && k.transform !== 'none'))));
  expect(spatial).toBe(false);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const save = dialog.getByRole('button', { name: 'Saved', exact: true });
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(save.locator('.icon')).toHaveCSS('scale', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/r=/);
});


test('saving pulses once on action and restored favorites stay still', async ({ page }) => {
  await page.goto('/');
  const heart = page.getByRole('button', { name: 'Save Red Lentil Soup', exact: true });
  await heart.click();
  const saved = page.getByRole('button', { name: 'Unsave Red Lentil Soup', exact: true });
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  expect(await saved.locator('.icon').evaluate((icon) => icon.getAnimations().some((a) =>
    (a.effect as KeyframeEffect).getKeyframes().some((k) => Number(k.scale) > 1)))).toBe(true);
  await expect(saved).not.toHaveClass(/saving/);
  await page.reload();
  await expect(saved).toBeVisible();
  expect(await saved.locator('.icon').evaluate((icon) => icon.getAnimations().length)).toBe(0);
  await saved.click();
  await heart.click();
  await saved.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  expect(await heart.locator('.icon').evaluate((icon) => icon.getAnimations().some((a) =>
    (a.effect as KeyframeEffect).getKeyframes().some((k) => Number(k.scale) > 1)))).toBe(false);
});

test('touch gestures allow scrolling without browser zoom on the page and sheets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('touch-action', 'pan-x pan-y');
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('touch-action', 'pan-x pan-y');
});
