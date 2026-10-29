import { expect, test } from './fixtures';

// Pancakes say "cornstarch" and brownies "corn starch"; brownies also weigh some of their sugar.
for (const { path, save, saved, open, aisle, starch } of [
  { path: '/', save: 'Save', saved: 'Saved · 2', open: 'Shopping list', aisle: 'baking & sweeteners', starch: '3 tbsp' },
  { path: '/it/', save: 'Salva', saved: 'Salvate · 2', open: 'Lista della spesa', aisle: 'Pasticceria e dolcificanti', starch: '3 cucchiai' }
]) {
  test(`saved recipes share one row per ingredient concept on ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(path);
    await page.getByRole('button', { name: `${save} Fluffy Vegan Pancakes`, exact: true }).click();
    await page.getByRole('button', { name: `${save} Fudgy Vegan Brownies`, exact: true }).click();
    await page.getByRole('button', { name: saved, exact: true }).click();
    await page.getByRole('button', { name: open, exact: true }).click();

    const list = page.getByRole('dialog');
    const groceries = list.getByTestId('grocery-list');
    await expect(groceries.locator('li', { hasText: /starch/ })).toHaveCount(1);
    const baking = list.getByRole('heading', { name: aisle, exact: true }).locator('xpath=following-sibling::ul[1]');
    await expect(baking.locator('li', { hasText: 'cornstarch' })).toContainText(starch);
    // 3/4 cup and 2 tbsp of sugar are weighed through the density table and added to the blog's 25 g.
    await expect(baking.locator('li', { has: page.getByText('sugar', { exact: true }) })).toContainText('≈ 200 g');
    expect(errors).toEqual([]);
  });
}
