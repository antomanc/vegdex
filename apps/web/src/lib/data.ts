import { shardOf, type Catalog } from '@vegdex/core'

const base = import.meta.env.BASE_URL

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${base}data/catalog.json`)
  if (!res.ok) throw new Error(`Could not load recipes (HTTP ${res.status})`)
  return res.json()
}

const shards = new Map<number, Promise<Record<string, string[]>>>()

/** Raw ingredient lines for one recipe, from its detail shard. */
export async function loadIngredients(id: string): Promise<string[]> {
  const n = shardOf(id)
  let shard = shards.get(n)
  if (!shard) {
    shard = fetch(`${base}data/details/${String(n).padStart(2, '0')}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    shard.catch(() => shards.delete(n))
    shards.set(n, shard)
  }
  return (await shard)[id] ?? []
}
