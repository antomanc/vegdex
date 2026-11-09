import { expect, test } from './fixtures';

test('a recipe contains scrolling at both edges and preserves the underlying grid position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  // A card far enough down the grid that opening it needs the page scrolled first.
  const card = page.getByRole('button', { name: 'Fudgy Vegan Brownies', exact: true });
  await card.scrollIntoViewIfNeeded();
  const before = await card.evaluate((node) => ({ top: node.getBoundingClientRect().top, scroll: scrollY }));
  expect(before.scroll).toBeGreaterThan(0);
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('ingredients')).toBeVisible();
  const bounds = await dialog.boundingBox();
  if (!bounds) throw new Error('Missing recipe sheet');
  const gridTop = () => card.evaluate((node) => node.getBoundingClientRect().top);

  // A wheel over the scrim must not move the page behind the modal.
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(200);
  expect(await gridTop()).toBeCloseTo(before.top, 0);

  await dialog.evaluate((node) => { node.scrollTop = 0; });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(200);
  expect(await gridTop()).toBeCloseTo(before.top, 0);
  await expect(dialog).toHaveCSS('overscroll-behavior-y', 'contain');

  // The ingredients must still scroll, without handing the gesture to the page at the end.
  await page.mouse.wheel(0, 400);
  // The compositor applies the wheel on its next frame; reading inside rAF asks for one (#105).
  await expect.poll(() => dialog.evaluate((node) => new Promise<number>((done) => requestAnimationFrame(() => done(node.scrollTop))))).toBeGreaterThan(0);
  await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(200);
  expect(await gridTop()).toBeCloseTo(before.top, 0);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before.scroll, 0);
  await page.mouse.move(190, 350);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before.scroll);
});

test('Back restores the grid, while a source shelf starts at its own heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  const card = page.getByRole('button', { name: 'Red Lentil Soup', exact: true });
  await card.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await card.click();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: /^ElaVegan/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ElaVegan', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('finger drags scroll only the open sheet and stop at its boundaries', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch interaction on the mobile project');
  await page.setViewportSize({ width: 390, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 recipes/);
  const card = page.getByRole('button', { name: 'Red Lentil Soup', exact: true });
  await card.scrollIntoViewIfNeeded();
  const before = await card.evaluate((node) => node.getBoundingClientRect().top);
  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('ingredients')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const drag = async (from: number, to: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: from }] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: from + (to - from) * step / 10 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
  };
  await dialog.evaluate((node) => { node.scrollTop = 0; });
  await drag(200, 450);
  expect(await card.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(before, 0);
  expect(await dialog.evaluate((node) => node.scrollTop)).toBe(0);
  await drag(450, 200);
  expect(await dialog.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await dialog.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await drag(450, 200);
  expect(await card.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(before, 0);
  await cdp.detach();
});
