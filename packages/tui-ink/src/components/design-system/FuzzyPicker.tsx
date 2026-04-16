import React from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../../theme-context"
import { useAppStore } from "../../store"
import { resolveAction } from "../../keybindings"
import { Pane } from "./Pane"

type Key = {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  return?: boolean
  escape?: boolean
  backspace?: boolean
  delete?: boolean
  upArrow?: boolean
  downArrow?: boolean
}

interface Props<T> {
  title: string
  rows: number
  columns: number
  query: string
  idx: number
  items: T[]
  placeholder: string
  empty: React.ReactNode
  meta?: React.ReactNode
  footer?: React.ReactNode
  prompt?: string
  chrome?: number
  closeWithPalette?: boolean
  setQuery: React.Dispatch<React.SetStateAction<string>>
  setIdx: React.Dispatch<React.SetStateAction<number>>
  onPick: (item: T, idx: number) => void
  onClose: () => void
  onInput?: (input: string, key: Key, item: T | undefined, idx: number) => boolean
  renderItem: (item: T, selected: boolean, idx: number) => React.ReactNode
}

export function FuzzyPicker<T>({
  title,
  rows,
  columns,
  query,
  idx,
  items,
  placeholder,
  empty,
  meta,
  footer,
  prompt = "› ",
  chrome = 8,
  closeWithPalette,
  setQuery,
  setIdx,
  onPick,
  onClose,
  onInput,
  renderItem,
}: Props<T>) {
  const theme = useTheme()
  const bindings = useAppStore((s) => s.keybindings)
  const total = items.length
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const maxVisible = Math.max(1, rows - chrome)
  const start = Math.max(0, Math.min(safeIdx - Math.floor(maxVisible / 2), Math.max(0, total - maxVisible)))
  const visible = items.slice(start, start + maxVisible)

  useInput((input, key) => {
    const action = resolveAction(bindings, input, key, ["dialog", "global"])
    if (action === "close" || (closeWithPalette && action === "commandPalette")) {
      onClose()
      return
    }

    if (onInput?.(input, key, items[safeIdx], safeIdx)) return

    if (key.upArrow) {
      setIdx((v) => Math.max(0, v - 1))
      return
    }

    if (key.downArrow) {
      setIdx((v) => Math.min(Math.max(0, total - 1), v + 1))
      return
    }

    if (key.return && items[safeIdx]) {
      onPick(items[safeIdx]!, safeIdx)
      return
    }

    if (key.backspace || key.delete) {
      setQuery((v) => v.slice(0, -1))
      setIdx(0)
      return
    }

    if (key.ctrl || key.meta) return
    if (input && (input.startsWith("[<") || input.startsWith("[M"))) return
    if (!input) return
    setQuery((v) => v + input)
    setIdx(0)
  })

  return (
    <Pane title={title} rows={rows} columns={columns} meta={meta} footer={footer}>
      <Box marginBottom={1} flexDirection="row">
        <Text color={theme.cyan}>{prompt}</Text>
        <Text color={query ? theme.text : theme.subtext}>{query || placeholder}</Text>
        <Text color={theme.cyan}>│</Text>
      </Box>

      {total === 0 ? empty : visible.map((item, i) => renderItem(item, start + i === safeIdx, start + i))}
    </Pane>
  )
}
