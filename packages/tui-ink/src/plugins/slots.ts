import type { ReactNode } from "react"

type Entry = {
  id: string
  render: (props: Record<string, unknown>) => ReactNode
}

const registry = new Map<string, Entry[]>()
let seq = 0

export const slotRegistry = {
  register(name: string, render: (props: Record<string, unknown>) => ReactNode): string {
    const id = `slot-${++seq}`
    const entries = registry.get(name) ?? []
    entries.push({ id, render })
    registry.set(name, entries)
    return id
  },

  unregister(name: string, id: string): void {
    const entries = registry.get(name)
    if (!entries) return
    const next = entries.filter((e) => e.id !== id)
    if (next.length === 0) registry.delete(name)
    else registry.set(name, next)
  },

  // Returns all entries for a slot (last wins for "replace" mode, all for "append")
  get(name: string): Entry[] {
    return registry.get(name) ?? []
  },

  // Returns last registered entry (replace mode)
  last(name: string): Entry | undefined {
    const entries = registry.get(name) ?? []
    return entries[entries.length - 1]
  },
}
