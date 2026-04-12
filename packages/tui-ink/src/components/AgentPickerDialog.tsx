import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"

interface Props {
  rows: number
  columns: number
}

export function AgentPickerDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const agents = useAppStore((s) => s.agents)
  const currentAgent = useAppStore((s) => s.currentAgent)
  const setCurrentAgent = useAppStore((s) => s.setCurrentAgent)
  const popDialog = useAppStore((s) => s.popDialog)

  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)

  const q = query.toLowerCase()
  const filtered = agents.filter(
    (a) => !q || a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
  )

  const total = filtered.length
  const maxVisible = Math.max(1, rows - 8)
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const start = Math.max(0, safeIdx - Math.floor(maxVisible / 2))
  const visible = filtered.slice(start, start + maxVisible)

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
    if (key.return && filtered[safeIdx]) {
      const a = filtered[safeIdx]!
      setCurrentAgent(a.name === currentAgent ? undefined : a.name)
      popDialog()
      return
    }
    if (input === "x" && !key.ctrl && !key.meta) {
      setCurrentAgent(undefined)
      popDialog()
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
          Agent
        </Text>
        {currentAgent && <Text color={theme.overlay}> current: {currentAgent}</Text>}
      </Box>

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
          <Text color={theme.overlay}>search agents...</Text>
        )}
      </Box>

      {total === 0 && <Text color={theme.overlay}>No agents available.</Text>}

      {visible.map((a, i) => {
        const real = start + i
        const selected = real === safeIdx
        const active = a.name === currentAgent
        return (
          <Box key={a.name} flexDirection="column">
            <Box>
              <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
              <Text color={active ? theme.green : selected ? theme.text : theme.subtext} bold={selected}>
                {a.name}
              </Text>
              {active && <Text color={theme.green}>{" ✓"}</Text>}
              {a.model && <Text color={theme.overlay}>{`  ${a.model.providerID}/${a.model.modelID}`}</Text>}
            </Box>
            {selected && a.description && (
              <Box paddingLeft={4}>
                <Text color={theme.subtext}>{a.description}</Text>
              </Box>
            )}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={theme.overlay}>↑↓ navigate · enter select · x clear · type filter · esc close</Text>
      </Box>
    </Box>
  )
}
