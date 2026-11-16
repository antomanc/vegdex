// The one command that runs every check, in this order; CI runs it as is. The e2e suite runs after it in CI.
import { execSync } from 'node:child_process'

const steps = [
  'node scripts/wellkept-check.mjs',
  'node scripts/check-helper-tests.mjs',
  'node scripts/check-fixtures.mjs',
  'pnpm typecheck',
  'pnpm knip',
  'pnpm test'
]
for (const step of steps) {
  console.log('> ' + step)
  try {
    execSync(step, { stdio: 'inherit' })
  } catch {
    console.error('verify: failed at ' + step)
    process.exit(1)
  }
}
console.log('verify: every check passed')
