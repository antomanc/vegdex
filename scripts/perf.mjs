// `pnpm perf`: how the built app feels on a mid-range phone. Serves apps/web/dist gzipped, as GitHub Pages
// does, and drives a Pixel 7 with a 4x slower CPU on fast 4G. Build first (`pnpm build`) with real data in
// apps/web/public/data; the e2e fixtures are too small to measure.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const dist = fileURLToPath(new URL('../apps/web/dist', import.meta.url));
const runs = Number(process.argv[2] ?? 3);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const gzipped = new Map();

const server = http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  if (type.startsWith('image/png')) return res.writeHead(200, { 'content-type': type }).end(fs.readFileSync(file));
  if (!gzipped.has(file)) gzipped.set(file, gzipSync(fs.readFileSync(file)));
  res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'cache-control': 'no-store' }).end(gzipped.get(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const browser = await chromium.launch();

async function measure() {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  // Recipe photos come from the blogs; they are not part of what vegdex controls here.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Interaction latency as the browser reports it (Event Timing), the basis of INP.
  await page.addInitScript(() => {
    window.__interactions = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__interactions.push({ name: e.name, duration: e.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  });

  const t0 = Date.now();
  await page.goto(origin, { waitUntil: 'commit' });
  await page.getByTestId('recipe-card').first().waitFor({ timeout: 120000 });
  const firstCard = Date.now() - t0;
  // Everything loaded: the full catalog is searchable.
  await page.waitForFunction(() => /\d/.test(document.querySelector('[data-testid="result-count"]')?.textContent ?? ''), null, { timeout: 120000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(500);

  const typing = async (text) => {
    await page.evaluate(() => (window.__interactions = []));
    await page.getByRole('searchbox').pressSequentially(text, { delay: 120, timeout: 0 });
    await page.waitForTimeout(800);
    const keys = await page.evaluate(() => window.__interactions.filter((e) => e.name === 'keydown' || e.name === 'keyup' || e.name === 'keypress'));
    if (process.env.DEBUG) console.log(text, keys.map((k) => `${k.name}:${Math.round(k.duration)}`).join(' '));
    await page.getByRole('searchbox').fill('');
    await page.waitForTimeout(800);
    return Math.max(16, ...keys.map((k) => k.duration));
  };
  const keystroke = Math.max(await typing('chickpea curry'), await typing('pasta'));

  await page.evaluate(() => (window.__interactions = []));
  for (const name of [/^Sweet/, /≤ 30 min/]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(800);
    }
  }
  const tap = Math.max(16, ...(await page.evaluate(() => window.__interactions.filter((e) => e.name === 'pointerup' || e.name === 'click').map((e) => e.duration))));
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  await ctx.close();
  return { firstCard, ready, keystroke, tap, heap: Math.round(heap / 1e6), errors };
}

const results = [];
for (let i = 0; i < runs; i++) results.push(await measure());
await browser.close();
server.close();
const pick = (k) => median(results.map((r) => r[k]));
console.log(`Pixel 7, CPU ×4, fast 4G, median of ${runs}:`);
console.log(`  first recipe card   ${pick('firstCard')} ms`);
console.log(`  full catalog ready  ${pick('ready')} ms`);
console.log(`  slowest keystroke   ${pick('keystroke')} ms (Event Timing)`);
console.log(`  slowest filter tap  ${pick('tap')} ms`);
console.log(`  JS heap             ${pick('heap')} MB`);
const errors = results.flatMap((r) => r.errors);
if (errors.length) console.log('  page errors:', [...new Set(errors)]);
