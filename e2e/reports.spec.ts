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

for (const [prefix, label] of [['/', 'Your blog? Request removal'], ['/it/', 'È il tuo blog? Chiedi la rimozione']] as const) {
  test(`publishers can request removal from the footer on ${prefix}`, async ({ page }) => {
    await page.goto(prefix);
    const url = new URL((await page.locator('.credits').getByRole('link', { name: label, exact: true }).getAttribute('href'))!);
    expect(url.protocol + url.pathname).toBe('mailto:hello@antomanc.com');
    expect(decodeURIComponent(url.search)).toContain('subject=vegdex removal request');
    expect(decodeURIComponent(url.search)).toContain('a photo, a recipe or the whole blog');
  });
}

test('a recipe removed after a confirmed report cannot be found or opened', async ({ page }) => {
  await page.goto('/?q=Reported%20Fixture%20Recipe&r=reported-fixture');
  await expect(page.getByTestId('result-count')).toHaveText(/0 recipes/);
  await expect(page.getByTestId('recipe-card')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
