import React from "react"
import { Box, Text } from "ink"
import type { SnapshotFileDiff } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { primaryKey } from "../keybindings"

const PATCH_ROWS = 25

interface Props {
  diffs: SnapshotFileDiff[]
  open: boolean
  onToggle?: () => void
}

function PatchLines({ patch }: { patch: string }) {
  const theme = useTheme()
  const all = patch.split(/\r?\n/)
  const visible =
    all.length > PATCH_ROWS ? [...all.slice(0, PATCH_ROWS), `… ${all.length - PATCH_ROWS} more lines`] : all
  return (
    <>
      {visible.map((ln, i) => (
        <Text
          key={i}
          color={
            ln.startsWith("+++") || ln.startsWith("---")
              ? theme.subtext
              : ln.startsWith("+")
                ? theme.green
                : ln.startsWith("-")
                  ? theme.red
                  : ln.startsWith("@@")
                    ? theme.cyan
                    : theme.overlay
          }
          wrap="wrap"
        >
          {ln}
        </Text>
      ))}
    </>
  )
}

export function MessageDiff({ diffs, open, onToggle }: Props) {
  const theme = useTheme()
  const bindings = useAppStore((s) => s.keybindings)
  if (diffs.length === 0) return null

  const add = diffs.reduce((sum, item) => sum + item.additions, 0)
  const del = diffs.reduce((sum, item) => sum + item.deletions, 0)
  const toggle = primaryKey(bindings, "toggleDiffs", ["session"]) || "ctrl+g"

  return (
    <Box marginTop={1} paddingLeft={3} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={theme.overlay}>{open ? "▾" : "▸"}</Text>
        <Text color={theme.subtext}>
          edits {diffs.length} file{diffs.length === 1 ? "" : "s"}
        </Text>
        <Text color={theme.green}>{`+${add}`}</Text>
        <Text color={theme.red}>{`-${del}`}</Text>
        {onToggle && <Text color={theme.overlay}>{` ${toggle}: expand`}</Text>}
      </Box>

      {diffs.map((item) => (
        <Box key={item.file} marginTop={1} flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text
              color={item.status === "added" ? theme.green : item.status === "deleted" ? theme.red : theme.yellow}
            >
              {item.status === "added" ? "+" : item.status === "deleted" ? "-" : "~"}
            </Text>
            <Text color={theme.subtext} wrap="truncate-end">
              {item.file}
            </Text>
            <Text color={theme.green}>{`+${item.additions}`}</Text>
            <Text color={theme.red}>{`-${item.deletions}`}</Text>
          </Box>

          {open && (
            <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.surface0} flexDirection="column">
              <PatchLines patch={item.patch} />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
