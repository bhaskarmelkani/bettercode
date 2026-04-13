import React, { useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import * as Frecency from "../frecency"

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

  const total = entries.length
  const maxVisible = Math.max(1, rows - 8)
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const start = Math.max(0, safeIdx - Math.floor(maxVisible / 2))
  const visible = entries.slice(start, start + maxVisible)
  const prompt = "› "
  const value = query || "search models..."
  const fill = Math.max(0, columns - 4 - prompt.length - value.length - 1)

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
    if (key.return && entries[safeIdx]) {
      const e = entries[safeIdx]!
      trackFrecency(`model:${e.providerID}/${e.modelID}`)
      setCurrentModel({ providerID: e.providerID, modelID: e.modelID })
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
          Model
        </Text>
        {currentModel && (
          <Text backgroundColor={theme.blue} color={theme.base}>
            {" current "}
          </Text>
        )}
        {currentModel && <Text color={theme.overlay}>{` ${currentModel.modelID}`}</Text>}
      </Box>

      <Box marginBottom={1} flexDirection="row">
        <Text backgroundColor={theme.surface0} color={theme.cyan}>
          {prompt}
        </Text>
        <Text backgroundColor={theme.surface0} color={query ? theme.text : theme.overlay}>
          {value}
        </Text>
        <Text backgroundColor={theme.overlay} color={theme.base}>
          {" "}
        </Text>
        <Text backgroundColor={theme.surface0}>{fill > 0 ? " ".repeat(fill) : ""}</Text>
      </Box>

      {total === 0 && (
        <Text color={theme.overlay}>
          {providers.length === 0
            ? "No providers loaded."
            : "No connected providers. Connect one via Providers dialog."}
        </Text>
      )}

      {visible.map((e, i) => {
        const real = start + i
        const selected = real === safeIdx
        const current = e.isCurrent
        return (
          <Box key={`${e.providerID}/${e.modelID}`} flexDirection="column">
            <Box>
              <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
              <Text color={current ? theme.blue : selected ? theme.text : theme.subtext} bold={selected}>
                {e.name}
              </Text>
              <Text color={theme.overlay}>{`  ${e.providerID}`}</Text>
              {current && (
                <Text backgroundColor={theme.blue} color={theme.base}>
                  {" current "}
                </Text>
              )}
              {e.isRecent && !current && <Text color={theme.surface2}>{" ★"}</Text>}
            </Box>
            {selected && (
              <Box paddingLeft={4}>
                <Text color={theme.subtext}>
                  model: <Text color={theme.text}>{e.modelID}</Text>
                </Text>
              </Box>
            )}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={theme.overlay}>↑↓ navigate · enter select · type filter · esc close</Text>
      </Box>
    </Box>
  )
}
