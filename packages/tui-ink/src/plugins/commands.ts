import { registry } from "../commands/registry"
import type { AppCommand } from "../commands/registry"

/**
 * Creates a plugin-scoped command API.
 * All registered commands are tracked so they can be disposed together.
 * The plugin id is prepended to each command id to avoid collisions.
 */
export function createPluginCommandAPI(pluginId: string) {
  const unregs: (() => void)[] = []

  return {
    /**
     * Register one or more commands. Returns a function that unregisters them.
     * Supports both a static array and a reactive factory function.
     */
    register(cmds: AppCommand[]): () => void {
      const local: (() => void)[] = []
      for (const cmd of cmds) {
        const scoped: AppCommand = { ...cmd, id: `${pluginId}.${cmd.id}` }
        const unreg = registry.register(scoped)
        local.push(unreg)
        unregs.push(unreg)
      }
      return () => local.forEach((f) => f())
    },

    trigger(id: string): void {
      registry.trigger(`${pluginId}.${id}`)
    },

    /** Dispose all commands registered by this plugin. */
    dispose(): void {
      unregs.forEach((f) => f())
      unregs.length = 0
    },
  }
}
