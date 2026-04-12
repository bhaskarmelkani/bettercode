import { useState, useEffect } from "react"
import { registry, type AppCommand } from "./registry"

export function useCommands(): AppCommand[] {
  const [cmds, setCmds] = useState(() => registry.all())
  useEffect(() => registry.subscribe(() => setCmds(registry.all())), [])
  return cmds
}
