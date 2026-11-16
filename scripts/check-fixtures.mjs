// Fails when the committed e2e fixtures differ from what the parser and vocabulary emit today.
import { execSync } from 'node:child_process'

execSync('pnpm fixtures', { stdio: 'ignore' })
const stale = execSync('git status --porcelain -- e2e/fixtures', { encoding: 'utf8' })
  .split('\n')
  .filter((line) => line && line[1] !== ' ')
  .join('\n')
if (stale) {
  console.error(stale)
  console.error('The e2e fixtures are out of date with the parser and vocabulary: commit what pnpm fixtures just wrote to e2e/fixtures.')
  process.exit(1)
}
console.log('e2e fixtures are current')
