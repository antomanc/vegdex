// Mechanical rules for the web app that typecheck and knip don't cover. Run from the repo root; exits 1 on a violation.
// Files listed in BEFORE had matches when the rule landed and may keep at most that many: lower a number when
// you remove one, never raise it.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter((f) => f && fs.existsSync(path.join(root, f)))
const web = (f) => /^apps\/web\/src\/.*\.(svelte|ts)$/.test(f)
const reactive = (f) => /^apps\/web\/src\/lib\/reactive\/[^/]*\.svelte\.ts$/.test(f)

const rules = [
  {
    id: 'effects-in-reactive-only',
    re: /\$effect(\.pre)?\s*\(/g,
    files: (f) => web(f) && !reactive(f),
    before: { 'apps/web/src/App.svelte': 4, 'apps/web/src/lib/FilterBar.svelte': 1, 'apps/web/src/lib/GrocerySheet.svelte': 2, 'apps/web/src/lib/RecipeSheet.svelte': 1 },
    message: 'Use $derived for values, latest() for worker questions, intersect() for observers and flash()/settled() for timed state (apps/web/src/lib/reactive); when none fits, add a helper there named for its job, with a test beside it.'
  },
  {
    id: 'timers-in-reactive-only',
    re: /\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\s*\(/g,
    files: (f) => web(f) && !reactive(f),
    before: { 'apps/web/src/App.svelte': 1, 'apps/web/src/lib/IngredientField.svelte': 2 },
    message: 'Wait for the event itself (transitionend, a promise, tick(), an observer) or use flash()/settled() from apps/web/src/lib/reactive; a timer that patches over ordering spreads.'
  },
  {
    id: 'no-passthrough-helpers',
    re: /(\$effect(\.pre)?|\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback))\s*\(\s*(\(\s*\)\s*=>\s*)?[A-Za-z_$][\w$.]*(\(\s*\))?\s*[,)]/g,
    files: (f) => f.startsWith('apps/web/src/lib/reactive/'),
    before: {},
    message: 'A helper in lib/reactive owns one job (the latest answer, an observer, a timed flag); it must not hand a caller\'s callback straight to $effect or a timer. Write the helper named for that job instead.'
  },
  {
    id: 'ts-escape-hatches',
    re: /\bas any\b|as unknown as|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|svelte-ignore/g,
    files: (f) => web(f) || /^packages\/[^/]+\/src\/.*\.ts$/.test(f),
    before: { 'apps/web/src/lib/IngredientField.svelte': 1 },
    message: 'Fix the type or the markup instead of silencing the checker.'
  }
]

let failed = 0
for (const rule of rules) {
  for (const f of files.filter(rule.files)) {
    const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n')
    const hits = lines.flatMap((l, i) => [...l.matchAll(rule.re)].map(() => i + 1))
    if (hits.length > (rule.before[f] ?? 0)) {
      failed++
      console.error(f + ':' + hits.at(-1) + ': [' + rule.id + '] ' + rule.message)
    }
  }
}
if (failed) process.exit(1)
console.log('conventions: ' + rules.length + ' rules hold')
