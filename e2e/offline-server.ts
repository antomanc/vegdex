// Serves the built app with the fixture dataset at /data/, for the offline test.
// The service worker's fetches skip page.route, so the fixtures have to come from a real server.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const dist = path.join(import.meta.dirname, '../apps/web/dist');
const data = path.join(import.meta.dirname, 'fixtures/data');
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain', '.xml': 'application/xml'
};

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  let file = pathname.startsWith('/data/') ? path.join(data, pathname.slice('/data/'.length)) : path.join(dist, pathname);
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.argv[2]));
