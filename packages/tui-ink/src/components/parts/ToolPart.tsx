import React from "react"
import { Box, Text } from "ink"
import type { ToolPart } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"

interface Props {
  part: ToolPart
}

const STATUS_ICON = {
  pending: "◌",
  running: "◎",
  completed: "✓",
  error: "✗",
} as const

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

function inputSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input)
  if (keys.length === 0) return ""
  const first = keys[0]!
  const val = input[first]
  if (typeof val === "string") return truncate(val, 60)
  return truncate(JSON.stringify(val), 60)
}

export function ToolPart({ part }: Props) {
  const theme = useTheme()
  const { state } = part

  const statusColor = {
    pending: theme.overlay,
    running: theme.yellow,
    completed: theme.green,
    error: theme.red,
  }

  const color = statusColor[state.status]
  const icon = STATUS_ICON[state.status]

  const title =
    state.status === "completed" ? state.title : state.status === "running" ? (state.title ?? part.tool) : part.tool

  const summary =
    state.status === "running" || state.status === "pending"
      ? inputSummary(state.input as Record<string, unknown>)
      : state.status === "error"
        ? truncate(state.error, 80)
        : ""

  return (
    <Box marginTop={1} paddingLeft={3} flexDirection="row" gap={1} flexShrink={0}>
      <Text color={color}>{icon}</Text>
      <Box flexDirection="column">
        <Text color={color}>{title || part.tool}</Text>
        {summary ? (
          <Text wrap="wrap" color={theme.overlay}>
            {summary}
          </Text>
        ) : null}
        {state.status === "completed" && state.output ? (
          <Text wrap="wrap" color={theme.subtext} dimColor>
            {truncate(state.output, 120)}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}
