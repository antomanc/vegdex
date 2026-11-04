// Regenerate: pnpm ingest emit && pnpm build; serve apps/web/dist on :4173,
// then pnpm share-card. Requires real crawl data and publisher images.
// PNG compression requires Pillow (uv pip install pillow); set PYTHON for a venv.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch({ headless: true });
try {
  for (const [language, path, tagline, sources] of [
    ['en', '/', 'Find recipes by ingredient and time.', 'From all-vegan blogs.'],
    ['it', '/it/', 'Trova ricette per ingredienti e tempo.', 'Dai blog interamente vegani.']
  ]) {
    const page = await browser.newPage({ viewport: { width: 430, height: 780 }, deviceScaleFactor: 1, colorScheme: 'light', serviceWorkers: 'block' });
    await page.goto(`http://localhost:4173${path}`);
    await page.getByTestId('recipe-card').first().waitFor();
    await page.waitForFunction(() => !/Loading recipes|Caricamento ricette/.test(document.body.innerText));
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('[data-testid="recipe-card"] img')].slice(0, 4).map(img => img.decode()));
    });
    const shot = await page.screenshot();
    const font = await page.evaluate(() => [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).filter(rule => rule.startsWith('@font-face')).join('\n'));
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await card.goto('http://localhost:4173');
    await card.setContent(`<style>${font}
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#151515;font-family:'Work Sans Variable',Arial,sans-serif}
      main{width:1200px;height:630px;display:flex;align-items:center;justify-content:space-between;padding:40px 68px;gap:40px}
      h1{font-family:'Bowlby One','Arial Black',sans-serif;font-weight:400;font-size:84px;letter-spacing:-.01em;line-height:1;color:#2f6b3f;margin:0 0 28px}
      p{font-size:27px;line-height:1.4;margin:0;white-space:nowrap}small{display:block;font-size:23px;color:#5c5c55;margin-top:14px}
      img{width:305px;height:550px;object-fit:cover;object-position:top;border-radius:8px;border:3px solid #151515}
    </style><main><section><h1>vegdex</h1><p>${tagline}</p><small>${sources}</small></section><img src="data:image/png;base64,${shot.toString('base64')}" /></main>`);
    await card.evaluate(() => document.fonts.ready);
    const output = `apps/web/public/share-${language}.png`;
    await writeFile(output, await card.screenshot());
    // Palette PNG retains crisp text while keeping the photographic grid under 300 KB.
    execFileSync(process.env.PYTHON ?? 'python3', ['-c', 'from PIL import Image; import sys; p=sys.argv[1]; Image.open(p).convert("RGB").quantize(colors=128).save(p,optimize=True)', output]);
    await page.close();
    await card.close();
  }
} finally { await browser.close(); }
