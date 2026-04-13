import type { ReactNode } from "react"

type Render = (params: Record<string, unknown>) => ReactNode
type Listener = () => void

const routes = new Map<string, Render>()
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

export const pluginRoutes = {
  register(name: string, render: Render): () => void {
    routes.set(name, render)
    notify()
    return () => {
      routes.delete(name)
      notify()
    }
  },

  get(name: string): Render | undefined {
    return routes.get(name)
  },

  has(name: string): boolean {
    return routes.has(name)
  },

  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
