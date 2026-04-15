import React from "react"
import { Box, Text } from "ink"
import type { SnapshotFileDiff } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"

interface Props {
  diffs: SnapshotFileDiff[]
  open: boolean
}

function line(text: string, rows: number) {
  const out = text.split(/\r?\n/)
  if (out.length <= rows) return text
  return `${out.slice(0, rows).join("\n")}\n… ${out.length - rows} more lines`
}

export function MessageDiff({ diffs, open }: Props) {
  const theme = useTheme()
  if (diffs.length === 0) return null

  const add = diffs.reduce((sum, item) => sum + item.additions, 0)
  const del = diffs.reduce((sum, item) => sum + item.deletions, 0)

  return (
    <Box marginTop={1} paddingLeft={3} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={theme.overlay}>{open ? "▾" : "▸"}</Text>
        <Text color={theme.subtext}>
          edits {diffs.length} file{diffs.length === 1 ? "" : "s"}
        </Text>
        <Text color={theme.green}>{`+${add}`}</Text>
        <Text color={theme.red}>{`-${del}`}</Text>
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
              <Text color={theme.overlay} wrap="wrap">
                {line(item.patch, 12)}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
