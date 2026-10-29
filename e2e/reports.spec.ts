import { expect, test } from './fixtures';

for (const [prefix, label] of [['/', 'Report a problem'], ['/it/', 'Segnala un problema']] as const) {
  test(`recipe reports identify the recipe and UI language on ${prefix}`, async ({ page }) => {
    await page.goto(`${prefix}?r=lentil-soup`);
    const sheet = page.getByRole('dialog');
    const link = sheet.getByRole('link', { name: label, exact: true });
    await expect(link).toBeVisible();
    const url = new URL((await link.getAttribute('href'))!);
    expect(url.origin + url.pathname).toBe('https://github.com/antomanc/vegdex/issues/new');
    expect(url.searchParams.get('title')).toContain('Red Lentil Soup');
    expect(url.searchParams.get('body')).toContain('Recipe ID: lentil-soup');
    expect(url.searchParams.get('body')).toContain('https://example.com/lentil-soup/');
    expect(url.searchParams.get('body')).toContain(`UI language: ${prefix === '/' ? 'en' : 'it'}`);
    await expect(sheet.getByRole('link', { name: /ElaVegan/ })).toBeVisible();
  });
}

test('a recipe removed after a confirmed report cannot be found or opened', async ({ page }) => {
  await page.goto('/?q=Reported%20Fixture%20Recipe&r=reported-fixture');
  await expect(page.getByTestId('result-count')).toHaveText(/0 recipes/);
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
