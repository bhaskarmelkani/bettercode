import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useCommands } from "../commands/useCommands"
import { registry } from "../commands/registry"
import { useAppStore } from "../store"
import * as Frecency from "../frecency"

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
  const maxVisible = Math.max(1, rows - 9)
  const start = Math.max(0, idx - Math.floor(maxVisible / 2))

  // Build flat display list: registry entries then server entries
  type Entry =
    | { kind: "registry"; id: string; label: string; description?: string; category: string; keybind?: string }
    | { kind: "server"; name: string; description?: string }

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
    })),
  ]

  const visible = entries.slice(start, start + maxVisible)

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

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "k")) {
      popDialog()
      return
    }
    if (key.upArrow) {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setIdx((i) => Math.min(total - 1, i + 1))
      return
    }
    if (key.return && total > 0) {
      execute(idx)
      return
    }
    if (key.backspace || key.delete) {
      setQuery((v) => v.slice(0, -1))
      setIdx(0)
      return
    }
    if (key.ctrl || key.meta) return
    if (input) {
      setQuery((v) => v + input)
      setIdx(0)
    }
  })

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          Commands
        </Text>
        {total > 0 && <Text color={theme.overlay}> {total} available</Text>}
      </Box>

      {/* Filter input */}
      <Box marginBottom={1} borderStyle="single" borderColor={theme.surface2} paddingX={1}>
        <Text color={theme.cyan}>{"› "}</Text>
        {query ? (
          <Text color={theme.text}>
            {query}
            <Text backgroundColor={theme.overlay} color={theme.base}>
              {" "}
            </Text>
          </Text>
        ) : (
          <Text color={theme.overlay}>filter commands...</Text>
        )}
      </Box>

      {total === 0 && <Text color={theme.overlay}>No commands match.</Text>}

      {visible.map((entry, i) => {
        const real = start + i
        const selected = real === idx
        if (entry.kind === "registry") {
          return (
            <Box key={entry.id} flexDirection="column">
              <Box>
                <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
                <Text color={selected ? theme.text : theme.subtext} bold={selected}>
                  {entry.label}
                </Text>
                {entry.keybind && <Text color={theme.surface2}>{`  ${entry.keybind}`}</Text>}
                <Text color={theme.overlay}>{`  [${entry.category}]`}</Text>
              </Box>
              {selected && entry.description && (
                <Box paddingLeft={4}>
                  <Text color={theme.subtext}>{entry.description}</Text>
                </Box>
              )}
            </Box>
          )
        }
        return (
          <Box key={entry.name} flexDirection="column">
            <Box>
              <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
              <Text color={selected ? theme.text : theme.subtext} bold={selected}>
                {"/" + entry.name}
              </Text>
              <Text color={theme.overlay}>{`  [Command]`}</Text>
            </Box>
            {selected && entry.description && (
              <Box paddingLeft={4}>
                <Text color={theme.subtext}>{entry.description}</Text>
              </Box>
            )}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={theme.overlay}>↑↓ navigate · enter run · esc close · type to filter</Text>
      </Box>
    </Box>
  )
}
