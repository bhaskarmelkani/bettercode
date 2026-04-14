import { useState } from "react"
import { useAppStore } from "../store"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import type { SlashCommand } from "../components/SlashMenu"

const BUILTIN: SlashCommand[] = [
  { name: "undo", description: "Revert last message" },
  { name: "compact", description: "Compact (summarize) session" },
  { name: "thinking", description: "Toggle reasoning visibility" },
  { name: "clear", description: "Clear composer input" },
]

export function useSlashCommands(
  value: string,
  mentionActive: boolean,
  clear: () => void,
  setValue: (v: string | ((v: string) => string)) => void,
) {
  const [idx, setIdx] = useState(0)

  const commands = useAppStore((s) => s.commands)
  const setShowThinking = useAppStore((s) => s.setShowThinking)
  const showThinking = useAppStore((s) => s.showThinking)
  const regCmds = useCommands()

  const isSlash = value.startsWith("/") && !mentionActive
  const query = isSlash ? value.slice(1).toLowerCase() : ""

  const reg: SlashCommand[] = regCmds
    .filter((c) => c.slash && c.enabled !== false && !BUILTIN.find((b) => b.name === c.slash))
    .map((c) => ({ name: c.slash!, description: c.description ?? c.label }))

  const all: SlashCommand[] = [
    ...BUILTIN,
    ...reg,
    ...commands
      .filter((c) => c.name && !BUILTIN.find((b) => b.name === c.name) && !reg.find((r) => r.name === c.name))
      .map((c) => ({ name: c.name, description: c.description ?? "" })),
  ]

  const options = isSlash ? all.filter((c) => c.name.startsWith(query)).slice(0, 6) : []
  const visible = options.length > 0 && !mentionActive

  function select(cmd: SlashCommand) {
    if (cmd.name === "thinking") {
      setShowThinking(!showThinking)
      clear()
      return
    }
    if (cmd.name === "clear") {
      clear()
      return
    }
    const found = regCmds.find((c) => c.slash === cmd.name && c.enabled !== false)
    if (found) {
      clear()
      setIdx(0)
      registry.trigger(found.id)
      return
    }
    setValue("/" + cmd.name + " ")
    setIdx(0)
  }

  return { idx, setIdx, options, visible, select }
}
