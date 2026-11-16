#!/usr/bin/env node
// Per-file ratchet for the rules in .wellkept/state.json, vendored into a project by the wellkept skill.
// A per-file ceiling: a file may keep as many matches as it had when the rule landed (its
// baseline), counted per occurrence, never more; a file missing from the baseline may have none.
// It is not a guarantee that no new code matches: swapping an old match for a new one in the
// same file stays under the ceiling. Use a parser-based rule where that matters. Exit 1 on any violation.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/'
      re += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += /[.+^${}()|[\]\\]/.test(c) ? '\\' + c : c
  }
  return new RegExp('^' + re + '$')
}

export function repoRoot(start = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: start, encoding: 'utf8' }).trim()
  } catch {
    return start
  }
}

export function listFiles(root) {
  return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter((f) => f && fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile())
}

const textCache = new Map()
export function readText(root, file) {
  const key = root + '\0' + file
  if (!textCache.has(key)) {
    let text = null
    try {
      const buf = fs.readFileSync(path.join(root, file))
      if (buf.length < 2000000 && !buf.includes(0)) text = buf.toString('utf8')
    } catch {}
    textCache.set(key, text)
  }
  return textCache.get(key)
}

/** { file: [line number per occurrence] } for every match of the probe's pattern in the files it covers. */
export function matchProbe(root, files, probe) {
  const include = (probe.include ?? ['**']).map(globToRegExp)
  const exclude = (probe.exclude ?? []).map(globToRegExp)
  const re = new RegExp(probe.pattern, (probe.flags ?? '').replace('g', '') + 'g')
  const hits = {}
  for (const f of files) {
    if (!include.some((r) => r.test(f)) || exclude.some((r) => r.test(f))) continue
    const text = readText(root, f)
    if (text == null) continue
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(re)) {
        (hits[f] ??= []).push(i + 1)
        if (!m[0]) break
      }
    }
  }
  return hits
}

export function statePath(root) {
  return path.join(root, '.wellkept', 'state.json')
}

export function loadState(root) {
  const p = statePath(root)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}

/** Violations and slack for each probed rule. */
export function ratchet(root, state, files = listFiles(root)) {
  const results = []
  for (const rule of state.rules ?? []) {
    if (!rule.probe) continue
    const hits = matchProbe(root, files, rule.probe)
    const baseline = rule.baseline ?? {}
    const violations = []
    let slack = 0
    for (const [f, lines] of Object.entries(hits)) {
      const allowed = baseline[f] ?? 0
      if (lines.length > allowed) violations.push({ file: f, lines, allowed })
    }
    for (const [f, allowed] of Object.entries(baseline)) slack += Math.max(0, allowed - (hits[f]?.length ?? 0))
    const total = Object.values(hits).reduce((n, l) => n + l.length, 0)
    results.push({ id: rule.id, message: rule.message, total, violations, slack })
  }
  return results
}

/** Declined findings whose revisitProbe now matches: the condition that would reopen them has happened. */
export function dueDeclines(root, state, files = listFiles(root)) {
  const due = []
  for (const d of state.declined ?? []) {
    if (!d.revisitProbe) continue
    const hits = Object.entries(matchProbe(root, files, d.revisitProbe))
    if (hits.length) due.push({ id: d.id ?? d.intent, revisitWhen: d.revisitWhen, at: hits.slice(0, 3).map(([f, l]) => f + ':' + l[0]) })
  }
  return due
}

// Enforcement changes: compared with <ref> (the main branch in CI), a rule removed or loosened, a ceiling raised,
// the verify command changed, or a protected config file edited fails unless the commit says so with a
// "Wellkept-Change: <reason>" trailer, so weakening a guardrail is always an explicit, reviewable decision.
export function enforcementChanges(root, ref) {
  const git = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' })
  let old
  try { old = JSON.parse(git(['show', ref + ':.wellkept/state.json'])) } catch { return [] }
  const now = loadState(root) ?? { rules: [] }
  const changes = []
  if ((old.verify ?? '') !== (now.verify ?? '')) changes.push('verify command changed: "' + old.verify + '" -> "' + now.verify + '"')
  const byId = Object.fromEntries((now.rules ?? []).map((r) => [r.id, r]))
  for (const o of old.rules ?? []) {
    const n = byId[o.id]
    if (!n) { changes.push('rule removed: ' + o.id); continue }
    for (const k of ['check', 'probe']) if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) changes.push(o.id + ': ' + k + ' changed')
    for (const [f, c] of Object.entries(n.baseline ?? {})) if (c > (o.baseline?.[f] ?? 0)) changes.push(o.id + ': ceiling raised for ' + f + ' (' + (o.baseline?.[f] ?? 0) + ' -> ' + c + ')')
  }
  const protectedFiles = [...new Set([...(old.protected ?? []), ...(now.protected ?? [])])]
  if (protectedFiles.length) {
    const diff = git(['diff', '--name-only', ref, '--', ...protectedFiles]).split('\n').filter(Boolean)
    for (const f of diff) changes.push('protected file changed: ' + f)
  }
  return changes
}

function main() {
  const root = repoRoot()
  const against = process.argv.indexOf('--against')
  if (against !== -1) {
    const ref = process.argv[against + 1]
    const changes = enforcementChanges(root, ref)
    if (changes.length) {
      const msg = execFileSync('git', ['log', '-1', '--format=%B'], { cwd: root, encoding: 'utf8' })
      const trailer = msg.match(/^Wellkept-Change:\s*(.+)$/m)
      for (const c of changes) console.error('wellkept-check: enforcement change since ' + ref + ': ' + c)
      if (!trailer) {
        console.error('wellkept-check: these weaken or alter guardrails. If intended, say why in the commit with a "Wellkept-Change: <reason>" trailer, for review.')
        return 1
      }
      console.log('wellkept-check: enforcement change declared: ' + trailer[1])
    }
  }
  const state = loadState(root)
  if (!state) {
    console.log('wellkept-check: no .wellkept/state.json, nothing to check')
    return 0
  }
  let failed = 0
  for (const r of ratchet(root, state)) {
    for (const v of r.violations) {
      failed++
      const where = v.allowed ? ' (' + v.allowed + ' allowed in this file from before the rule)' : ''
      console.error(v.file + ':' + v.lines.join(',') + ': [' + r.id + '] ' + r.message + where)
    }
    if (r.slack) console.log('wellkept-check: [' + r.id + '] ' + r.slack + ' old match(es) gone; run the wellkept skill to lower the baseline')
  }
  for (const d of dueDeclines(root, state)) console.log('wellkept-check: declined [' + d.id + '] is due for review, its revisitWhen now applies (' + d.at.join(', ') + '); run the wellkept skill to decide it again')
  if (!failed) console.log('wellkept-check: ' + (state.rules ?? []).filter((r) => r.probe).length + ' ratcheted rule(s) hold')
  return failed ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main())
