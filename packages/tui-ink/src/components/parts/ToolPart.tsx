import React from "react"
import { Box, Text } from "ink"
import type { ToolPart } from "@opencode-ai/sdk/v2"
import { useAppStore } from "../../store"
import { useTheme } from "../../theme-context"
import type { Theme } from "../../theme"

interface Props {
  part: ToolPart
}

const STAT = {
  pending: { icon: "◌", color: "overlay" },
  running: { icon: "◎", color: "yellow" },
  completed: { icon: "✓", color: "green" },
  error: { icon: "✗", color: "red" },
} as const

function cut(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function line(text: string, max: number) {
  const rows = text.split(/\r?\n/)
  if (rows.length <= max) return text
  return `${rows.slice(0, max).join("\n")}\n… ${rows.length - max} more lines`
}

function span(input: Record<string, unknown>) {
  return cut(
    Object.entries(input)
      .slice(0, 3)
      .map(([key, value]) => {
        if (typeof value === "string") return value
        if (typeof value === "number" || typeof value === "boolean") return String(value)
        if (Array.isArray(value)) return `${key}[${value.length}]`
        if (value && typeof value === "object") return key
        return key
      })
      .filter(Boolean)
      .join(" "),
    80,
  )
}

function json(input: Record<string, unknown>) {
  return line(JSON.stringify(input, null, 2), 30)
}

function dur(start: number, end?: number) {
  const ms = (end ?? Date.now()) - start
  if (ms < 1000) return `${ms}ms`
  const sec = (ms / 1000).toFixed(ms < 10_000 ? 1 : 0)
  return `${sec}s`
}

function kind(tool: string, theme: Theme) {
  const t = tool.toLowerCase()
  if (t.includes("read") || t.includes("file_read")) return { icon: "◇", color: theme.cyan }
  if (t.includes("write") || t.includes("edit") || t.includes("file_write")) return { icon: "✎", color: theme.yellow }
  if (t.includes("bash") || t.includes("shell") || t.includes("execute")) return { icon: "$", color: theme.green }
  if (t.includes("glob") || t.includes("grep") || t.includes("search")) return { icon: "⊕", color: theme.lavender }
  if (t.startsWith("mcp__")) return { icon: "⬡", color: theme.pink }
  return { icon: "◎", color: theme.blue }
}

export function ToolPart({ part }: Props) {
  const theme = useTheme()
  const collapsed = useAppStore((s) => s.collapsedTools[part.id])
  const state = part.state
  const stat = STAT[state.status]
  const kid = kind(part.tool, theme)
  const open = state.status !== "completed" || collapsed === false
  const sum = span(state.input)
  const title = state.status === "completed" && state.title ? state.title : sum ? `${part.tool} ${sum}` : part.tool
  const time = "time" in state ? dur(state.time.start, "end" in state.time ? state.time.end : undefined) : ""
  const body =
    state.status === "error" ? (
      <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.red} flexDirection="column">
        <Text wrap="wrap" color={theme.subtext}>
          {line(cut(state.error, 2000), 30)}
        </Text>
      </Box>
    ) : state.status === "completed" ? (
      <Box marginTop={1} paddingX={1} borderStyle="round" borderColor={theme.surface0} flexDirection="column">
        <Text wrap="wrap" color={theme.subtext}>
          {line(cut(state.output, 2000), 30)}
        </Text>
      </Box>
    ) : (
      <Box marginTop={1} paddingX={1} borderStyle="round" borderColor={theme.surface0} flexDirection="column">
        <Text wrap="wrap" color={theme.overlay}>
          {json(state.input)}
        </Text>
      </Box>
    )

  return (
    <Box marginTop={0} paddingLeft={3} flexDirection="column" flexShrink={0}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={1}>
          <Text color={theme.overlay}>{open ? "▾" : "▸"}</Text>
          <Text color={theme[stat.color]}>{stat.icon}</Text>
          <Text color={kid.color}>{kid.icon}</Text>
          <Text color={theme[stat.color]} wrap="truncate-end">
            {title}
          </Text>
        </Box>
        <Text color={theme.overlay}>{time}</Text>
      </Box>
      {open ? body : null}
    </Box>
  )
}
