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
    (a.effect as KeyframeEffect).getKeyframes().some((k) => k.translate || k.rotate)));
  expect(spatial).toBe(false);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const save = dialog.getByRole('button', { name: 'Saved', exact: true });
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(save.locator('.icon')).toHaveCSS('scale', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/r=/);
});
