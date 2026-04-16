import React, { useState } from "react"
import { Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { themes } from "../theme"
import { FuzzyPicker, ListItem } from "./design-system"

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

  // No live preview — theme is only applied on Enter to avoid global rerenders.

  return (
    <FuzzyPicker
      title="Themes"
      rows={rows}
      columns={columns}
      query={query}
      idx={idx}
      items={filtered}
      placeholder="filter themes..."
      empty={<Text color={theme.overlay}>No themes match.</Text>}
      meta={<Text color={theme.overlay}> {filtered.length} available</Text>}
      footer={<Text color={theme.overlay}>↑↓ navigate · enter confirm · esc close · type to filter</Text>}
      closeWithPalette={true}
      setQuery={setQuery}
      setIdx={setIdx}
      onPick={(item) => {
        setTheme(item)
        popDialog()
      }}
      onClose={popDialog}
      renderItem={(item, selected) => (
        <ListItem
          key={item}
          label={item}
          selected={selected}
          active={item === initial}
          tail={item === initial ? <Text color={theme.green}> ✓</Text> : undefined}
        />
      )}
    />
  )
}
