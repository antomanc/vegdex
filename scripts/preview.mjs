import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// vite runs directly, not under pnpm (which moves children into their own groups),
// so the pid is the server and leads its own process group.
const groupAlive = (pid) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** The process group of our preview, or null. A pid file from before the last boot names someone else's process. */
const running = () => {
  if (!fs.existsSync(pidFile)) return null;
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  const bootedAt = Date.now() - os.uptime() * 1000;
  // kill(-0) would signal our own group and kill(-1) every process, so anything below 2 is junk.
  if (Number.isInteger(pid) && pid > 1 && fs.statSync(pidFile).mtimeMs > bootedAt && groupAlive(pid)) return pid;
  fs.rmSync(pidFile);
  return null;
};

async function kill(pid) {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
  for (let i = 0; i < 20 && groupAlive(pid); i++) await sleep(250);
  if (groupAlive(pid)) process.kill(-pid, 'SIGKILL');
  fs.rmSync(pidFile, { force: true });
}

const portFree = () => new Promise((resolve) => {
  const server = net.createServer().once('error', () => resolve(false));
  server.listen(PORT, '0.0.0.0', () => server.close(() => resolve(true)));
});

async function start() {
  // Restart rather than reuse, so the preview always serves the current code.
  const previous = running();
  if (previous) {
    console.log('Stopping the running preview to rebuild');
    await kill(previous);
  }
  if (!(await portFree())) {
    console.error(`Port ${PORT} is in use by another process; free it and retry`);
    process.exit(1);
  }
  const build = spawnSync('pnpm', ['--filter', '@vegdex/web', 'build'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  const log = fs.openSync(logFile, 'w');
  const web = path.join(root, 'apps/web');
  const child = spawn(path.join(web, 'node_modules/.bin/vite'), ['preview', '--host', '0.0.0.0', '--port', String(PORT), '--strictPort'],
    { cwd: web, detached: true, stdio: ['ignore', log, log] });
  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) break;
    if (await fetch(url).then((r) => r.ok, () => false)) return console.log(`Preview running at ${url} (log: ${path.relative(root, logFile)})`);
    await sleep(500);
  }
  await kill(child.pid);
  console.error(`Preview did not start; see ${path.relative(root, logFile)}`);
  process.exit(1);
}

async function stop() {
  const pid = running();
  if (!pid) return console.log('No preview running');
  await kill(pid);
  console.log('Preview stopped');
}

const command = process.argv[2];
if (command === 'start') await start();
else if (command === 'stop') await stop();
else {
  console.log(`pnpm preview:start | preview:stop\nBuilds apps/web and serves it in the background at ${url}, bound to 0.0.0.0.\nStarting again rebuilds and restarts it.`);
  process.exitCode = command ? 1 : 0;
}
