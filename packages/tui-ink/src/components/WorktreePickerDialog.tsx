import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  rows: number
  columns: number
}

export function WorktreePickerDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const client = useAppStore((s) => s.client)
  const worktrees = useAppStore((s) => s.worktrees)
  const setWorktrees = useAppStore((s) => s.setWorktrees)
  const popDialog = useAppStore((s) => s.popDialog)
  const directory = useAppStore((s) => s.directory)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!client) return
    setLoading(true)
    client.worktree
      .list({ directory })
      .then((r) => {
        const dirs = (r.data as string[] | null) ?? []
        setWorktrees(dirs)
        setIdx(0)
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [client, directory])

  const items = worktrees.map((dir) => ({
    label: dir.split("/").pop() ?? dir,
    dir,
  }))

  useInput((_input, key) => {
    if (key.escape) { popDialog(); return }
    if (key.upArrow) { setIdx((i) => Math.max(0, i - 1)); return }
    if (key.downArrow) { setIdx((i) => Math.min(items.length - 1, i + 1)); return }
    if (key.return) {
      const item = items[idx]
      if (item) {
        // Show which worktree was selected via toast, then close
        useAppStore.getState().addToast({
          title: "Worktree",
          message: `Selected: ${item.label} (${item.dir})`,
          variant: "info",
          duration: 3000,
        })
        popDialog()
      }
    }
  })

  const listHeight = Math.max(1, rows - 6)
  const visible = items.slice(Math.max(0, idx - Math.floor(listHeight / 2)), idx + Math.ceil(listHeight / 2) + 1)
  const startOffset = Math.max(0, idx - Math.floor(listHeight / 2))

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box paddingX={2} paddingY={1}>
        <Text color={theme.cyan} bold>Worktrees</Text>
        <Text color={theme.overlay}> — ↑↓ navigate · enter select · esc close</Text>
      </Box>

      {loading && (
        <Box paddingX={2}>
          <Text color={theme.cyan}>Loading…</Text>
        </Box>
      )}

      {error && (
        <Box paddingX={2} flexDirection="column">
          <Text color={theme.red}>Error loading worktrees</Text>
          <Text color={theme.overlay}>{error}</Text>
        </Box>
      )}

      {!loading && !error && items.length === 0 && (
        <Box paddingX={2} flexDirection="column">
          <Text color={theme.overlay}>No worktrees found.</Text>
          <Text color={theme.overlay} dimColor>Run `git worktree add` to create one.</Text>
        </Box>
      )}

      {!loading && !error && items.map((item, i) => {
        const absIdx = startOffset + visible.indexOf(item)
        if (absIdx < 0) return null
        const selected = i === idx
        return (
          <Box key={item.dir} paddingX={2} flexDirection="row">
            <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "❯" : " "} </Text>
            <Box flexDirection="column">
              <Text color={selected ? theme.text : theme.subtext} bold={selected}>
                {item.label}
              </Text>
              <Text color={theme.overlay} dimColor wrap="truncate-end">
                {item.dir}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
