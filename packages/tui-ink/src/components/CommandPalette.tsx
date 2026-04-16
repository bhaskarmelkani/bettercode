import React, { useState } from "react"
import { Text } from "ink"
import { useTheme } from "../theme-context"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import { useAppStore } from "../store"
import * as Frecency from "../frecency"
import { FuzzyPicker, ListItem } from "./design-system"

interface Props {
  rows: number
  columns: number
}

export function CommandPalette({ rows, columns }: Props) {
  const theme = useTheme()
  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)
  const cmds = useCommands()
  const serverCmds = useAppStore((s) => s.commands)
  const popDialog = useAppStore((s) => s.popDialog)
  const freq = useAppStore((s) => s.frecency)
  const trackFrecency = useAppStore((s) => s.trackFrecency)

  const q = query.toLowerCase()

  // Registry-based commands: filter then sort by frecency (ties keep registration order)
  const filtered = cmds
    .filter((c) => {
      if (c.enabled === false) return false
      if (!q) return true
      return (
        c.label.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false) ||
        c.category.toLowerCase().includes(q) ||
        (c.slash?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort((a, b) => {
      const fa = freq[`cmd:${a.id}`]
      const fb = freq[`cmd:${b.id}`]
      if (fa && fb) return Frecency.current(fb) - Frecency.current(fa)
      if (fa) return -1
      if (fb) return 1
      return 0
    })

  // Server-side slash commands shown as a supplemental section
  const serverFiltered = serverCmds.filter((c) => {
    if (!q) return true
    return c.name.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
  })

  const total = filtered.length + serverFiltered.length

  // Build flat display list: registry entries then server entries
  type Entry =
    | { kind: "registry"; id: string; label: string; description?: string; category: string; keybind?: string }
    | { kind: "server"; name: string; description?: string; source?: "command" | "mcp" | "skill"; hints?: string[] }

  const entries: Entry[] = [
    ...filtered.map((c) => ({
      kind: "registry" as const,
      id: c.id,
      label: c.label,
      description: c.description,
      category: c.category,
      keybind: c.keybind,
    })),
    ...serverFiltered.map((c) => ({
      kind: "server" as const,
      name: c.name,
      description: c.description,
      source: c.source,
      hints: c.hints,
    })),
  ]

  function execute(i: number) {
    const entry = entries[i]
    if (!entry) return
    popDialog()
    if (entry.kind === "registry") {
      trackFrecency(`cmd:${entry.id}`)
      setTimeout(() => registry.trigger(entry.id), 0)
    } else {
      setTimeout(() => {
        const { client, currentSessionID } = useAppStore.getState()
        if (!client || !currentSessionID) return
        client.session.command({ sessionID: currentSessionID, command: entry.name }).catch(() => {})
      }, 0)
    }
  }

  return (
    <FuzzyPicker
      title="Commands"
      rows={rows}
      columns={columns}
      query={query}
      idx={idx}
      items={entries}
      placeholder="filter commands..."
      empty={<Text color={theme.overlay}>No commands match.</Text>}
      meta={total > 0 ? <Text color={theme.overlay}> {total} available</Text> : undefined}
      footer={<Text color={theme.overlay}>↑↓ navigate · enter run · esc close · type to filter</Text>}
      chrome={9}
      closeWithPalette={true}
      setQuery={setQuery}
      setIdx={setIdx}
      onPick={(_, i) => execute(i)}
      onClose={popDialog}
      renderItem={(entry, selected) => {
        if (entry.kind === "registry") {
          return (
            <ListItem
              key={entry.id}
              label={entry.label}
              selected={selected}
              tail={
                <>
                  {entry.keybind ? <Text color={theme.surface2}>{`  ${entry.keybind}`}</Text> : null}
                  <Text color={theme.overlay}>{`  [${entry.category}]`}</Text>
                </>
              }
              detail={
                selected && entry.description ? <Text color={theme.subtext}>{entry.description}</Text> : undefined
              }
            />
          )
        }

        const tag = entry.source === "mcp" ? "MCP" : entry.source === "skill" ? "Skill" : "Command"
        return (
          <ListItem
            key={entry.name}
            label={`/${entry.name}`}
            selected={selected}
            tail={<Text color={theme.overlay}>{`  [${tag}]`}</Text>}
            detail={
              selected && (entry.description || entry.hints?.length) ? (
                <Text color={theme.subtext}>
                  {entry.description ?? ""}
                  {entry.hints?.length ? ` ${entry.hints.join(" ")}` : ""}
                </Text>
              ) : undefined
            }
          />
        )
      }}
    />
  )
}
