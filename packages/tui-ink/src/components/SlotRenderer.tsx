import React from "react"
import { slotRegistry } from "../plugins/slots"

interface Props {
  name: string
  props?: Record<string, unknown>
  /** "replace" renders only the last registered entry. "append" renders all. Defaults to "append". */
  mode?: "replace" | "append"
}

/**
 * Renders plugin-registered slot content for a named slot.
 * If no plugin has registered for this slot, renders nothing.
 */
export function SlotRenderer({ name, props = {}, mode = "append" }: Props) {
  if (mode === "replace") {
    const entry = slotRegistry.last(name)
    if (!entry) return null
    return <>{entry.render(props)}</>
  }

  const entries = slotRegistry.get(name)
  if (entries.length === 0) return null
  return (
    <>
      {entries.map((e) => (
        <React.Fragment key={e.id}>{e.render(props)}</React.Fragment>
      ))}
    </>
  )
}
