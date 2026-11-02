import type { CatalogRecipe, IngredientLookup, RecipeQuery } from '@vegdex/core'
import type { CatalogRequest, Found, Loaded } from './catalog.worker'

export type { Found, Loaded }

let worker: Worker | null = null
// After a crash a new worker would start without the catalog and answer every search with nothing:
// until the catalog is loaded again, every other call fails, and the page offers to try again.
let lost = false
let next = 0
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

function connect(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./catalog.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const call = pending.get(data.id)
    pending.delete(data.id)
    if (data.error !== undefined) call?.reject(new Error(data.error))
    else call?.resolve(data.result)
  }
  // A worker that fails to start or crashes answers nothing: fail every open call, and start afresh next time.
  worker.onerror = (event) => {
    event.preventDefault()
    for (const call of pending.values()) call.reject(new Error(event.message || 'Catalog worker failed'))
    pending.clear()
    worker?.terminate()
    worker = null
    lost = true
  }
  return worker
}

function ask<T>(request: CatalogRequest, transfer: Transferable[] = []): Promise<T> {
  if (request.kind === 'catalog') lost = false
  else if (lost && request.kind !== 'titles') return Promise.reject(new Error('Catalog worker restarted without its catalog'))
  const id = ++next
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    connect().postMessage({ id, request }, transfer)
  })
}

/** The catalog lives in a worker; these calls take plain data (no reactive proxies) and answer with copies. */
export const catalog = {
  /** Hands the catalog.json bytes over without copying them. */
  load: (data: ArrayBuffer, lookup: IngredientLookup, language: string) => ask<Loaded>({ kind: 'catalog', data, lookup, language }, [data]),
  titles: (titles: Record<string, string> | null) => ask<null>({ kind: 'titles', titles }),
  search: (query: RecipeQuery, limit: number, countIds?: string[]) => ask<Found>({ kind: 'search', query, limit, countIds }),
  rows: (ids: string[]) => ask<CatalogRecipe[]>({ kind: 'rows', ids }),
  counts: (queries: RecipeQuery[]) => ask<number[]>({ kind: 'counts', queries })
}
