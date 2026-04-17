import React from "react"
import { Box, Text } from "ink"
import type { ToolPart as ToolPartSDK } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"
import { toolKind } from "../../utils/toolKind"
import { groupState, groupTitle } from "../../utils/toolGroup"
import { shortPath } from "./ToolPart"

interface Props {
  parts: ToolPartSDK[]
  open: boolean
  overview?: boolean
}

function dur(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
}

export const ToolGroup = React.memo(function ToolGroup({ parts, open, overview }: Props) {
  const theme = useTheme()
  const first = parts[0]
  if (!first) return null

  const kid = toolKind(first.tool, theme)
  const state = groupState(parts)
  const icon = state === "error" ? "✗" : state === "running" ? "◎" : "✓"
  // Kind color while running; green on completion; red on error.
  const iconColor =
    state === "completed" ? theme.green :
    state === "error" ? theme.red :
    kid.color

  const total = parts.reduce((sum, part) => {
    if (!("time" in part.state)) return sum
    const end = "end" in part.state.time ? part.state.time.end : Date.now()
    return sum + (end - part.state.time.start)
  }, 0)

  return (
    <Box paddingLeft={3} flexDirection="column" flexShrink={0}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={1}>
          <Text color={theme.overlay}>{overview ? " " : open ? "▾" : "▸"}</Text>
          <Text color={iconColor}>{icon}</Text>
          <Text color={theme.overlay} wrap="truncate-end">
            {shortPath(groupTitle(parts))}
          </Text>
        </Box>
        <Text color={theme.overlay}>{total > 0 ? dur(total) : ""}</Text>
      </Box>
      {!overview && open && (
        <Box paddingLeft={4} flexDirection="column">
          {parts.map((part) => {
            const s = part.state.status
            const icon = s === "error" ? "✗" : s === "running" ? "◎" : s === "completed" ? "✓" : "◌"
            const iconColor =
              s === "completed" ? theme.green :
              s === "error" ? theme.red :
              kid.color
            const time =
              "time" in part.state
                ? dur(("end" in part.state.time ? part.state.time.end : Date.now()) - part.state.time.start)
                : ""
            const rawTitle = "title" in part.state && part.state.title ? part.state.title : part.tool

            return (
              <Box key={part.id} flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row" gap={1} flexShrink={1}>
                  <Text color={iconColor}>{icon}</Text>
                  <Text color={theme.overlay} wrap="truncate-end">
                    {shortPath(rawTitle)}
                  </Text>
                </Box>
                <Text color={theme.overlay}>{time}</Text>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
})
