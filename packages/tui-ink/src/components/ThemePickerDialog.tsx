import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { themes } from "../theme"

interface Props {
  rows: number
  columns: number
}

const THEME_NAMES = Object.keys(themes).sort()

export function ThemePickerDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const currentThemeName = useAppStore((s) => s.currentThemeName)
  const setTheme = useAppStore((s) => s.setTheme)
  const popDialog = useAppStore((s) => s.popDialog)

  // Track the initial theme so we can show which is the current default
  const [initial] = useState(currentThemeName)
  const [idx, setIdx] = useState(() => Math.max(0, THEME_NAMES.indexOf(currentThemeName)))
  const [query, setQuery] = useState("")

  const filtered = query ? THEME_NAMES.filter((n) => n.toLowerCase().includes(query.toLowerCase())) : THEME_NAMES

  const safeIdx = Math.min(idx, Math.max(0, filtered.length - 1))
  const maxVisible = Math.max(1, rows - 8)
  const start = Math.max(0, safeIdx - Math.floor(maxVisible / 2))
  const visible = filtered.slice(start, start + maxVisible)
  const prompt = "› "
  const value = query || "filter themes..."

  // No live preview — theme is only applied on Enter to avoid global rerenders.

  useInput((input, key) => {
    if (key.escape) {
      popDialog()
      return
    }
    if (key.upArrow) {
      setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setIdx((i) => Math.min(filtered.length - 1, i + 1))
      return
    }
    if (key.return && filtered[safeIdx]) {
      // Confirm selection — apply and close
      setTheme(filtered[safeIdx]!)
      popDialog()
      return
    }
    if (key.backspace || key.delete) {
      setQuery((v) => v.slice(0, -1))
      setIdx(0)
      return
    }
    if (key.ctrl || key.meta) return
    if (input && (input.startsWith("[<") || input.startsWith("[M"))) return
    if (input) {
      setQuery((v) => v + input)
      setIdx(0)
    }
  })

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          Themes
        </Text>
        <Text color={theme.overlay}> {filtered.length} available</Text>
      </Box>

      <Box marginBottom={1} flexDirection="row">
        <Text color={theme.cyan}>{prompt}</Text>
        <Text color={query ? theme.text : theme.subtext}>{value}</Text>
        <Text color={theme.cyan}>│</Text>
      </Box>

      {filtered.length === 0 && <Text color={theme.overlay}>No themes match.</Text>}

      {visible.map((name, i) => {
        const real = start + i
        const selected = real === safeIdx
        return (
          <Box key={name}>
            <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
            <Text color={name === initial ? theme.green : selected ? theme.text : theme.subtext} bold={selected}>
              {name}
            </Text>
            {name === initial && <Text color={theme.green}>{" ✓"}</Text>}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={theme.overlay}>↑↓ navigate · enter confirm · esc close · type to filter</Text>
      </Box>
    </Box>
  )
}
