import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

// Builds the web app and serves it in the background for agent-browser checks.
// Port 4173 stays clear of 4174, which pnpm test:e2e builds and serves itself.
const PORT = 4173;
const root = fileURLToPath(new URL('..', import.meta.url));
const pidFile = path.join(root, '.data/preview.pid');
const logFile = path.join(root, '.data/preview.log');
const url = `http://localhost:${PORT}`;

const running = () => {
  if (!fs.existsSync(pidFile)) return null;
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    fs.rmSync(pidFile);
    return null;
  }
};

async function start() {
  if (running()) return console.log(`Preview already running at ${url} (pnpm preview:stop to stop it)`);
  const build = spawnSync('pnpm', ['--filter', '@vegdex/web', 'build'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  const log = fs.openSync(logFile, 'w');
  const child = spawn('pnpm', ['--filter', '@vegdex/web', 'preview', '--host', '0.0.0.0', '--port', String(PORT), '--strictPort'],
    { cwd: root, detached: true, stdio: ['ignore', log, log] });
  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) break;
    if (await fetch(url).then((r) => r.ok, () => false)) return console.log(`Preview running at ${url} (log: ${path.relative(root, logFile)})`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stop();
  console.error(`Preview did not start; see ${path.relative(root, logFile)}`);
  process.exit(1);
}

function stop() {
  const pid = running();
  if (!pid) return console.log('No preview running');
  // The server runs in its own process group: pnpm, then vite under it.
  process.kill(-pid, 'SIGTERM');
  fs.rmSync(pidFile);
  console.log('Preview stopped');
}

const command = process.argv[2];
if (command === 'start') await start();
else if (command === 'stop') stop();
else {
  console.log(`pnpm preview:start | preview:stop\nBuilds apps/web and serves it in the background at ${url}, bound to 0.0.0.0.`);
  process.exitCode = command ? 1 : 0;
}
