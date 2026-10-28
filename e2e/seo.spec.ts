import { expect, test } from './fixtures';

const canonical = 'https://vegdex.antomanc.com/';

test('crawl discovery files advertise the canonical homepage', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain(`Sitemap: ${canonical}sitemap.xml`);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');
  expect(await sitemap.text()).toContain(`<loc>${canonical}</loc>`);
  expect(await sitemap.text()).not.toMatch(/<loc>[^<]*[?#]/);
});

test('initial HTML identifies the site and filtered views keep its canonical', async ({ page, request }) => {
  const response = await request.get('/?meal=soup');
  const html = await response.text();
  expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
  expect(html).toContain('application/ld+json');

  await page.goto('/?meal=soup');
  await expect(page.getByTestId('recipe-card')).toHaveText([/Red Lentil Soup/]);
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await expect(page).toHaveURL(/r=lentil-soup/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);

  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? 'null');
  expect(schema).toMatchObject({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'vegdex', url: canonical, inLanguage: 'en' });
});
