import { expect, test } from './fixtures';

const canonical = 'https://vegdex.antomanc.com/';

for (const { path, language, ogLocale } of [
  { path: '/', language: 'en', ogLocale: 'en_US' },
  { path: '/it/', language: 'it', ogLocale: 'it_IT' }
]) {
  test(`${language} initial HTML identifies its language and reciprocal alternatives`, async ({ page, request }) => {
    const response = await request.get(`${path}?meal=soup`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const metadata = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return {
        language: doc.documentElement.lang,
        canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        url: doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
        ogLocale: doc.querySelector('meta[property="og:locale"]')?.getAttribute('content'),
        alternates: [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
        schema: JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent ?? 'null')
      };
    }, html);
    const url = `${canonical}${path.slice(1)}`;
    expect(metadata).toEqual({
      language, canonical: url, url, ogLocale,
      alternates: [['en', canonical], ['it', `${canonical}it/`], ['x-default', canonical]],
      schema: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'vegdex', url, inLanguage: language }
    });
    expect(html).not.toMatch(/%[A-Z_]+%/);
  });
}

test('crawl discovery files advertise both canonical pages with reciprocal alternatives', async ({ request, page }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain(`Sitemap: ${canonical}sitemap.xml`);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');
  const sitemapXml = await sitemap.text();
  expect(sitemapXml).toContain(`<loc>${canonical}</loc>`);
  expect(sitemapXml).not.toMatch(/<loc>[^<]*[?#]/);
  const entries = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagName('url')].map((entry) => ({
      url: entry.getElementsByTagName('loc')[0]?.textContent,
      alternates: [...entry.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')].map((link) => [link.getAttribute('rel'), link.getAttribute('hreflang'), link.getAttribute('href')])
    }));
  }, sitemapXml);
  const alternates = [['alternate', 'en', canonical], ['alternate', 'it', `${canonical}it/`], ['alternate', 'x-default', canonical]];
  expect(entries).toEqual([{ url: canonical, alternates }, { url: `${canonical}it/`, alternates }]);
});

test('initial HTML identifies the site and filtered views keep its canonical', async ({ page, request }) => {
  const response = await request.get('/?meal=soup');
  const html = await response.text();
  expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
  expect(html).toContain('application/ld+json');
  expect(html).toContain(`<meta property="og:image" content="${canonical}icon-512.png"`);
  expect(html).not.toContain('%SITE_URL%');

  await page.goto('/?meal=soup');
  await expect(page.getByTestId('recipe-card')).toHaveText([/Red Lentil Soup/]);
  await page.getByRole('button', { name: 'Red Lentil Soup', exact: true }).click();
  await expect(page).toHaveURL(/r=lentil-soup/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);

  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? 'null');
  expect(schema).toMatchObject({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'vegdex', url: canonical, inLanguage: 'en' });
});

test('installing from Italian uses an Italian manifest and starts in Italian', async ({ page, request }) => {
  await page.goto('/it/');
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveCount(1);
  await expect(manifestLink).toHaveAttribute('href', '/it/manifest.webmanifest');
  const manifestUrl = new URL(await manifestLink.getAttribute('href') ?? '', page.url());
  const response = await request.get(manifestUrl.href);
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'vegdex: trova ricette vegane per ingrediente e tempo',
    short_name: 'vegdex',
    description: "Trova ricette vegane dai blog di cucina interamente vegani. Filtra per ingredienti, pasto e tempo di cottura, poi vai dall'autore originale per la ricetta.",
    lang: 'it', start_url: '/it/', scope: '/it/', display: 'standalone'
  });
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    const image = await request.get(new URL(icon.src, manifestUrl).href);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
  }
  await page.goto(new URL(manifest.start_url, manifestUrl).href);
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('button', { name: 'Altri filtri', exact: true })).toBeVisible();
});
