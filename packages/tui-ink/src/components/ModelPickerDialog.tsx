import React, { useState, useMemo } from "react"
import { Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import * as Frecency from "../frecency"
import { FuzzyPicker, ListItem } from "./design-system"

interface Props {
  rows: number
  columns: number
}

export function ModelPickerDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const providers = useAppStore((s) => s.providers)
  const providerConnected = useAppStore((s) => s.providerConnected)
  const currentModel = useAppStore((s) => s.currentModel)
  const recentModels = useAppStore((s) => s.recentModels)
  const setCurrentModel = useAppStore((s) => s.setCurrentModel)
  const popDialog = useAppStore((s) => s.popDialog)
  const freq = useAppStore((s) => s.frecency)
  const trackFrecency = useAppStore((s) => s.trackFrecency)

  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)

  type Entry = { providerID: string; modelID: string; name: string; isRecent: boolean; isCurrent: boolean }

  const entries = useMemo<Entry[]>(() => {
    const q = query.toLowerCase()
    const recentSet = new Set(recentModels.map((r) => `${r.providerID}/${r.modelID}`))
    const current = currentModel ? `${currentModel.providerID}/${currentModel.modelID}` : ""

    const all: Entry[] = []
    for (const p of providers) {
      if (!providerConnected.includes(p.id)) continue
      for (const [modelID, model] of Object.entries(p.models)) {
        const key = `${p.id}/${modelID}`
        if (
          q &&
          !model.name.toLowerCase().includes(q) &&
          !modelID.toLowerCase().includes(q) &&
          !p.name.toLowerCase().includes(q)
        )
          continue
        all.push({
          providerID: p.id,
          modelID,
          name: model.name,
          isRecent: recentSet.has(key),
          isCurrent: key === current,
        })
      }
    }

    // Sort: current first, then by frecency score, then recents, then alpha
    return all.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      const fa = freq[`model:${a.providerID}/${a.modelID}`]
      const fb = freq[`model:${b.providerID}/${b.modelID}`]
      if (fa && fb) return Frecency.current(fb) - Frecency.current(fa)
      if (fa) return -1
      if (fb) return 1
      if (a.isRecent && !b.isRecent) return -1
      if (!a.isRecent && b.isRecent) return 1
      return a.name.localeCompare(b.name)
    })
  }, [providers, providerConnected, currentModel, recentModels, freq, query])

  return (
    <FuzzyPicker
      title="Model"
      rows={rows}
      columns={columns}
      query={query}
      idx={idx}
      items={entries}
      placeholder="search models..."
      empty={
        <Text color={theme.overlay}>
          {providers.length === 0
            ? "No providers loaded."
            : "No connected providers. Connect one via Providers dialog."}
        </Text>
      }
      meta={currentModel ? <Text color={theme.overlay}>{` current: ${currentModel.modelID}`}</Text> : undefined}
      footer={<Text color={theme.overlay}>↑↓ navigate · enter select · type filter · esc close</Text>}
      prompt="> "
      closeWithPalette={true}
      setQuery={setQuery}
      setIdx={setIdx}
      onPick={(item) => {
        trackFrecency(`model:${item.providerID}/${item.modelID}`)
        setCurrentModel({ providerID: item.providerID, modelID: item.modelID })
        popDialog()
      }}
      onClose={popDialog}
      renderItem={(item, selected) => (
        <ListItem
          key={`${item.providerID}/${item.modelID}`}
          label={item.name}
          selected={selected}
          active={item.isCurrent}
          lead="> "
          tail={
            <>
              <Text color={theme.overlay}>{`  ${item.providerID}`}</Text>
              {item.isCurrent ? <Text color={theme.green}> ✓</Text> : null}
            </>
          }
        />
      )}
    />
  )
}
