#!/usr/bin/env node
// Ratchet for the rules in .ratchet/state.json, vendored into a project by the ratchet skill.
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
    else re += /[.+^$\{\}()|[\]\\]/.test(c) ? '\\' + c : c
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
  return path.join(root, '.ratchet', 'state.json')
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

function main() {
  const root = repoRoot()
  const state = loadState(root)
  if (!state) {
    console.log('ratchet-check: no .ratchet/state.json, nothing to check')
    return 0
  }
  let failed = 0
  for (const r of ratchet(root, state)) {
    for (const v of r.violations) {
      failed++
      const where = v.allowed ? ' (' + v.allowed + ' allowed in this file from before the rule)' : ''
      console.error(v.file + ':' + v.lines.join(',') + ': [' + r.id + '] ' + r.message + where)
    }
    if (r.slack) console.log('ratchet-check: [' + r.id + '] ' + r.slack + ' old match(es) gone; run the ratchet skill to lower the baseline')
  }
  if (!failed) console.log('ratchet-check: ' + (state.rules ?? []).filter((r) => r.probe).length + ' ratcheted rule(s) hold')
  return failed ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(main())
