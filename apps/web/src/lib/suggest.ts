/** One edit (insert, delete or substitute) between two short strings. */
export function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (la > lb) i++
    else if (lb > la) j++
    else {
      i++
      j++
    }
  }
  return edits + (la - i) + (lb - j) <= 1
}

/** Prefix of `lower` matches `term` with at most one typo (term length ≥ 4). */
export function fuzzyPrefix(lower: string, term: string): boolean {
  // Under 4 characters a single edit matches too many short ingredient names.
  if (term.length < 4) return false
  if (oneEditApart(term, lower.slice(0, term.length))) return true
  if (oneEditApart(term, lower.slice(0, term.length + 1))) return true
  if (oneEditApart(term, lower.slice(0, term.length - 1))) return true
  return false
}

export type SuggestHit = { name: string; at: number; len: number }

/** Ranked ingredient suggestions: exact prefix, then substring, then one-typo prefix. */
export function suggestNames(
  names: { name: string; lower: string }[],
  term: string,
  chosen: Set<string>,
  shown = 5
): SuggestHit[] {
  if (!term) return []
  const first: SuggestHit[] = []
  const inside: SuggestHit[] = []
  const fuzzy: SuggestHit[] = []
  for (const { name, lower } of names) {
    if (chosen.has(lower)) continue
    const at = lower.indexOf(term)
    if (at === 0) {
      first.push({ name, at: 0, len: term.length })
      if (first.length === shown) break
    } else if (at > 0) {
      if (inside.length < shown) inside.push({ name, at, len: term.length })
    } else if (fuzzy.length < shown && fuzzyPrefix(lower, term)) {
      fuzzy.push({ name, at: 0, len: Math.min(term.length, lower.length) })
    }
  }
  if (first.length === shown) return first
  return [...first, ...inside, ...fuzzy].slice(0, shown)
}
