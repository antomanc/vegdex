import type { FullDataset } from '@vegdex/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_DATA_URL = 'https://antomanc.github.io/vegdex/data/recipes.full.json'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function cacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
  return path.join(base, 'vegdex')
}

/**
 * Load the dataset: VEGDEX_DATA_FILE if set, else the cached copy, refreshed
 * from VEGDEX_DATA_URL (default: the public site) once it is a day old.
 * A failed refresh falls back to the stale cache so agents keep working offline.
 */
export async function loadDataset(log: (msg: string) => void = () => {}): Promise<FullDataset> {
  const local = process.env.VEGDEX_DATA_FILE
  if (local) return JSON.parse(fs.readFileSync(local, 'utf8'))

  const url = process.env.VEGDEX_DATA_URL || DEFAULT_DATA_URL
  const dir = cacheDir()
  const file = path.join(dir, 'recipes.full.json')
  const meta = path.join(dir, 'meta.json')
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS
  if (fresh) return JSON.parse(fs.readFileSync(file, 'utf8'))

  try {
    const etag = fs.existsSync(meta) ? (JSON.parse(fs.readFileSync(meta, 'utf8')).etag as string | undefined) : undefined
    const res = await fetch(url, {
      headers: etag && fs.existsSync(file) ? { 'if-none-match': etag } : {},
      signal: AbortSignal.timeout(60_000)
    })
    fs.mkdirSync(dir, { recursive: true })
    if (res.status === 304) {
      const now = new Date()
      fs.utimesSync(file, now, now)
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
    const text = await res.text()
    const data = JSON.parse(text) as FullDataset
    fs.writeFileSync(file + '.tmp', text)
    fs.renameSync(file + '.tmp', file)
    fs.writeFileSync(meta, JSON.stringify({ etag: res.headers.get('etag') ?? undefined, url }))
    log(`vegdex: downloaded ${data.recipes.length} recipes`)
    return data
  } catch (err) {
    if (fs.existsSync(file)) {
      log(`vegdex: refresh failed (${(err as Error).message}); using cached data`)
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    }
    throw err
  }
}
