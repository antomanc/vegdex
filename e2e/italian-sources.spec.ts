import { expect, italianFixtureData, test } from './fixtures';

for (const language of ['en', 'it'] as const) {
  test(`an enriched Italian recipe is safely browsable in ${language}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/data/**', italianFixtureData);
    await page.goto(language === 'it' ? '/it/' : '/');
    await page.getByRole('searchbox').fill(language === 'it' ? 'lunare' : 'lunar');
    await expect(page.getByTestId('recipe-card')).toHaveCount(1);
    await page.getByRole('button', { name: language === 'it' ? 'Frittelle lunari' : 'Lunar pancakes', exact: true }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('ingredients')).toContainText(language === 'it' ? '200 g farina lunare, setacciata finemente' : '200 g lunar flour, finely sifted');
    await expect(sheet.getByRole('link', { name: /Cucina di prova/ })).toHaveAttribute('href', 'https://italian.example/frittelle/');
    expect(errors).toEqual([]);
  });

  test(`an Italian-source recipe searches, renders and merges into the shopping list in ${language}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/data/**', italianFixtureData);
    const italian = language === 'it';
    const title = italian ? 'Insalata italiana di ceci' : 'Italian Chickpea Salad';
    await page.goto(italian ? '/it/' : '/');
    await page.getByRole('searchbox').fill(italian ? 'ceci' : 'chickpeas');
    await expect(page.getByTestId('recipe-card')).toHaveCount(2);
    await page.getByRole('button', { name: title, exact: true }).click();
    let sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('ingredients')).toContainText(italian ? '400 g ceci, scolati e sciacquati' : /400 g chick ?peas, drained and rinsed/);
    await expect(sheet.getByTestId('ingredients')).toContainText(italian ? '1,5 cucchiai' : '1.5 tbsp');
    if (!italian) {
      await expect(sheet.locator('.original-title')).toHaveText('Insalata italiana di ceci');
      await sheet.getByText('Original ingredients', { exact: true }).click();
      await expect(sheet.getByTestId('original-ingredients')).toContainText('400 g ceci, scolati e sciacquati');
    }
    await expect(sheet.getByRole('link', { name: /Cucina di prova/ })).toHaveAttribute('href', 'https://italian.example/insalata/');
    await sheet.getByRole('button', { name: italian ? 'Chiudi' : 'Close', exact: true }).click();
    await page.getByRole('button', { name: `${italian ? 'Salva' : 'Save'} ${title}`, exact: true }).click();
    await page.getByRole('button', { name: `${italian ? 'Salva Insalata di quinoa al limone' : 'Save Lemony Quinoa Salad'}`, exact: true }).click();
    await page.getByRole('button', { name: italian ? 'Salvate · 2' : 'Saved · 2', exact: true }).click();
    await page.getByRole('button', { name: italian ? 'Lista della spesa' : 'Shopping list', exact: true }).click();
    sheet = page.getByRole('dialog');
    const groceries = sheet.getByTestId('grocery-list');
    const chickpeas = groceries.locator('li', { hasText: italian ? /ceci/ : /chick ?pea/ });
    await expect(chickpeas).toHaveCount(1);
    await expect(chickpeas).toContainText('800 g');
    await expect(sheet.getByRole('heading', { name: italian ? 'Legumi' : 'beans & legumes', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`Italian cup measures use the known flour density on the recipe sheet in ${language}`, async ({ page }) => {
    await page.route('**/data/**', italianFixtureData);
    await page.addInitScript(() => localStorage.setItem('vegdex:units', 'metric'));
    await page.goto(`${language === 'it' ? '/it/' : '/'}?r=italian-crackers`);
    const ingredients = page.getByRole('dialog').getByTestId('ingredients');
    await expect(ingredients).toContainText('≈ 125 g');
    await expect(ingredients).toContainText(language === 'it' ? 'farina' : 'flour');
  });
}
