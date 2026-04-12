/**
 * Frecency = frequency + recency.
 *
 * Each item stores a floating-point score that grows by 1 on every access and
 * decays exponentially over time.  Half-life is ~7 days (decay constant 0.1/day).
 *
 * On access:
 *   score = score * exp(-k * dt_days) + 1
 *
 * To rank items call `current(entry)` which returns the live decayed score.
 */

const K = 0.1 // decay constant; ln(2)/K ≈ 7 day half-life

export type Entry = { score: number; last: number }
export type Store = Record<string, Entry>

export function access(store: Store, key: string): Store {
  const now = Date.now()
  const prev = store[key]
  const dt = prev ? (now - prev.last) / 86_400_000 : 0
  const decayed = prev ? prev.score * Math.exp(-K * dt) : 0
  return { ...store, [key]: { score: decayed + 1, last: now } }
}

export function current(entry: Entry): number {
  const dt = (Date.now() - entry.last) / 86_400_000
  return entry.score * Math.exp(-K * dt)
}

export function sort<T>(items: T[], store: Store, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const sa = store[key(a)]
    const sb = store[key(b)]
    const va = sa ? current(sa) : 0
    const vb = sb ? current(sb) : 0
    return vb - va
  })
}
