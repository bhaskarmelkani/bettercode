import React, { useState } from "react"
import { Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { FuzzyPicker, ListItem } from "./design-system"

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

  return (
    <FuzzyPicker
      title="Agent"
      rows={rows}
      columns={columns}
      query={query}
      idx={idx}
      items={filtered}
      placeholder="search agents..."
      empty={<Text color={theme.overlay}>No agents available.</Text>}
      meta={currentAgent ? <Text color={theme.overlay}> current: {currentAgent}</Text> : undefined}
      footer={<Text color={theme.overlay}>↑↓ navigate · enter select · x clear · type filter · esc close</Text>}
      closeWithPalette={true}
      setQuery={setQuery}
      setIdx={setIdx}
      onPick={(item) => {
        setCurrentAgent(item.name === currentAgent ? undefined : item.name)
        popDialog()
      }}
      onClose={popDialog}
      onInput={(input, key) => {
        if (input !== "x" || key.ctrl || key.meta) return false
        setCurrentAgent(undefined)
        popDialog()
        return true
      }}
      renderItem={(item, selected) => (
        <ListItem
          key={item.name}
          label={item.name}
          selected={selected}
          active={item.name === currentAgent}
          tail={
            <>
              {item.name === currentAgent ? <Text color={theme.green}> ✓</Text> : null}
              {item.model ? <Text color={theme.overlay}>{`  ${item.model.providerID}/${item.model.modelID}`}</Text> : null}
            </>
          }
          detail={selected && item.description ? <Text color={theme.subtext}>{item.description}</Text> : undefined}
        />
      )}
    />
  )
}
