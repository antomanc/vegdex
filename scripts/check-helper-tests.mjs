// Fails when a helper in apps/web/src/lib/reactive has no test beside it (latest.svelte.ts -> latest.svelte.test.ts).
// The folder is exempt from the effect and timer rules, so its helpers' lifecycle is guarded by their tests.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = 'apps/web/src/lib/reactive'
const files = fs.readdirSync(path.join(root, dir), { recursive: true }).map((f) => path.posix.join(dir, f.split(path.sep).join('/')))
const isTest = (f) => /\.test\.ts$/.test(f)
const helpers = files.filter((f) => /\.(ts|svelte)$/.test(f) && !isTest(f))
const untested = helpers.filter((f) => !files.includes(f.replace(/\.ts$/, '') + '.test.ts'))
for (const f of untested) console.error(f + ': [reactive-helpers-tested] a helper in lib/reactive needs a test beside it (' + path.posix.basename(f.replace(/\.ts$/, '')) + '.test.ts) that covers teardown, changing inputs and separate instances')
if (untested.length) process.exit(1)
console.log('reactive helpers: ' + helpers.length + ' tested')
