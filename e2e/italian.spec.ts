import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/it/');
  await expect(page.getByTestId('result-count')).toHaveText(/6 ricette/);
});

test('/it/ is its own Italian page', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page).toHaveTitle(/vegdex: .*ricette vegane/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /ricette vegane/);
});

test('English stays at the root', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Desserts', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dolci', exact: true })).toHaveCount(0);
});

test('meal filters are in Italian while the URL keeps English identifiers', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Desserts', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dolci', exact: true }).click();
  await expect(page).toHaveURL(/\/it\/\?meal=dessert/);
  await expect(page.getByTestId('result-count')).toHaveText(/1 ricetta/);
  await page.reload();
  await expect(page.getByTestId('recipe-card')).toHaveText([/Fudgy Vegan Brownies/]);
  await expect(page.getByRole('button', { name: 'Dolci', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('a recipe opens and closes on /it/', async ({ page }) => {
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Red Lentil Soup' })).toBeVisible();
  await expect(sheet.getByTestId('ingredients').locator('li')).toHaveCount(6);
  await sheet.getByRole('button', { name: 'Chiudi' }).click();
  await expect(sheet).toBeHidden();
});

test('filters and result plurals follow the page language', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Stasera', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Ordina per' })).toContainText('Più votate');
  await page.getByRole('button', { name: 'Altri filtri', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('button', { name: 'Senza glutine', exact: true })).toBeVisible();
  await expect(sheet.getByLabel('Deve contenere')).toBeVisible();
  await sheet.getByRole('button', { name: 'Mostra 6 ricette', exact: true }).click();
  await page.getByRole('button', { name: 'Dolci', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText('1 ricetta');
  await expect(page.getByRole('button', { name: 'Rimuovi Dolci', exact: true })).toBeVisible();
});

test('recipe details and the source shelf read in Italian', async ({ page }) => {
  await page.getByRole('button', { name: 'Spinach Tofu Curry', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Ingredienti', exact: true })).toBeVisible();
  await expect(sheet.getByText('Per porzione', { exact: true })).toBeVisible();
  await expect(sheet.locator('dl')).toContainText('22 g di proteine');
  await expect(sheet.locator('.rating')).toContainText('4,8');
  await expect(sheet.getByText('(120 valutazioni)', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Ricche di proteine', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Cucina la ricetta su Vegan Richa', exact: true })).toBeVisible();
  await expect(sheet.getByText('Procedimento, foto e consigli sono su Vegan Richa. Visitare il blog sostiene chi crea le ricette.', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Vegan Richa: tutte le ricette', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vegan Richa', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visita veganricha.com', exact: true })).toBeVisible();
});

test('saved recipes build an Italian shopping list', async ({ page }) => {
  await page.getByRole('button', { name: 'Salva Spinach Tofu Curry', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Red Lentil Soup', exact: true }).click();
  await page.getByRole('button', { name: 'Salvate · 2', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ricette salvate', exact: true })).toBeVisible();
  await expect(page.getByTestId('result-count')).toHaveText('2 ricette salvate');
  await page.getByRole('button', { name: 'Lista della spesa', exact: true }).click();
  const list = page.getByRole('dialog');
  await expect(list.getByRole('heading', { name: 'Frutta e verdura', exact: true })).toBeVisible();
  await expect(list.getByRole('heading', { name: 'Legumi', exact: true })).toBeVisible();
  await expect(list.getByRole('heading', { name: 'Spezie', exact: true })).toBeVisible();
  await expect(list.locator('li', { hasText: 'garlic' })).toContainText('5 spicchi');
  await expect(list.getByRole('group', { name: 'Unità', exact: true })).toBeVisible();
  await list.getByText('Per 2 ricette salvate', { exact: true }).click();
  await expect(list.getByText('4 porzioni', { exact: true })).toBeVisible();
  await list.getByRole('button', { name: 'Aumenta le porzioni di Spinach Tofu Curry', exact: true }).click();
  await expect(list.getByText('5 porzioni', { exact: true })).toBeVisible();
  await list.getByRole('checkbox', { name: /garlic/ }).check();
  await list.getByRole('button', { name: 'Deseleziona tutto', exact: true }).click();
  await expect(list.getByRole('checkbox', { name: /garlic/ })).not.toBeChecked();
  await list.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('button', { name: 'Rimuovi dalle salvate: Red Lentil Soup', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText('1 ricetta salvata');
});

test('counts, compact ratings and times use Italian despite the browser language', async ({ page }) => {
  const catalog = JSON.parse(readFileSync(new URL('./fixtures/data/catalog.json', import.meta.url), 'utf8'));
  catalog.sources = [catalog.sources.find((source: { id: string }) => source.id === catalog.recipes[0].source)];
  catalog.recipes = Array.from({ length: 12345 }, (_, i) => ({
    ...catalog.recipes[0], id: `number-${i}`, ratingCount: 1200000, servings: 1.5, minutes: 90
  }));
  await page.route('**/data/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.reload();
  await expect(page.getByTestId('result-count')).toHaveText('12.345 ricette');
  await expect(page.locator('.credits')).toContainText('Ricette da 1 blog vegano.');
  const card = page.getByTestId('recipe-card').first();
  await expect(card.locator('.rating')).toContainText(/1,2\sMln valutazioni/);
  await expect(card.locator('.time')).toHaveText('1 h 30 min');
  await card.locator('.card-open').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('dl')).toContainText('1,5');
  await expect(sheet.locator('.rating')).toContainText('(1.200.000 valutazioni)');
});

test('empty states and the random pick flow read in Italian', async ({ page }) => {
  await page.getByRole('button', { name: 'Scegli per me', exact: true }).click();
  const sheet = page.getByRole('dialog');
  const firstTitle = await sheet.getByRole('heading', { level: 2 }).textContent();
  await sheet.getByRole('button', { name: 'Un’altra', exact: true }).click();
  await expect(sheet.getByRole('heading', { level: 2 })).not.toHaveText(firstTitle!);
  await sheet.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cerca ricette', exact: true }).fill('zzzz');
  await expect(page.getByText('Nessuna ricetta trovata per “zzzz”.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Cancella la ricerca/ }).click();
  await expect(page.getByTestId('result-count')).toHaveText('6 ricette');
  await page.getByRole('button', { name: 'Salvate', exact: true }).click();
  await expect(page.getByText('Non hai ancora salvato ricette.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sfoglia le ricette', exact: true })).toBeVisible();
});

test('catalog and recipe loading errors offer Italian recovery', async ({ page }) => {
  await page.route('**/data/catalog.json', (route) => route.fulfill({ status: 503 }));
  await page.reload();
  await expect(page.getByText('Non riesco a caricare le ricette. Controlla la connessione e riprova.', { exact: true })).toBeVisible();
  await page.unroute('**/data/catalog.json');
  await page.getByRole('button', { name: 'Riprova', exact: true }).click();
  await expect(page.getByTestId('result-count')).toHaveText('6 ricette');
  await page.route('**/data/details/**', (route) => route.fulfill({ status: 503 }));
  await page.getByRole('button', { name: 'Spinach Tofu Curry', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Gli ingredienti non sono disponibili senza connessione. Apri la ricetta su Vegan Richa.', { exact: true })).toBeVisible();
});

test('long Italian filter labels fit their buttons at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'Altri filtri', exact: true }).click();
  const label = page.getByRole('dialog').getByRole('button', { name: 'Senza frutta a guscio e arachidi', exact: true });
  await expect(label).toBeVisible();
  expect(await label.evaluate((button) => button.scrollWidth <= button.clientWidth)).toBe(true);
});
