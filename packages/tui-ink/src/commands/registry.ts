export type AppCommand = {
  id: string
  label: string
  description?: string
  category: string
  keybind?: string
  slash?: string
  enabled?: boolean
  action: () => void
}

type Listener = () => void

const cmds = new Map<string, AppCommand>()
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

export const registry = {
  register(cmd: AppCommand): () => void {
    cmds.set(cmd.id, cmd)
    notify()
    return () => {
      cmds.delete(cmd.id)
      notify()
    }
  },

  all(): AppCommand[] {
    return [...cmds.values()]
  },

  trigger(id: string): void {
    const cmd = cmds.get(id)
    if (!cmd || cmd.enabled === false) return
    cmd.action()
  },

  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
