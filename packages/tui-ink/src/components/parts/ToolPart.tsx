import React from "react"
import { Box, Text } from "ink"
import type { ToolPart as ToolPartSDK } from "@opencode-ai/sdk/v2"
import { useAppStore } from "../../store"
import { useTheme } from "../../theme-context"
import type { Theme } from "../../theme"

interface Props {
  part: ToolPartSDK
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

function truncLines(text: string, maxCols: number, maxRows: number) {
  const rows = text.split(/\r?\n/).map((row) => cut(row, maxCols))
  if (rows.length <= maxRows) return rows.join("\n")
  return `${rows.slice(0, maxRows).join("\n")}\n… ${rows.length - maxRows} more lines`
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

// 4 kind icons: ◇ read/search/glob/grep, ✎ write/edit, $ bash/execute, ⬡ mcp/other
function kind(tool: string, theme: Theme) {
  const t = tool.toLowerCase()
  if (t.includes("read") || t.includes("glob") || t.includes("grep") || t.includes("search"))
    return { icon: "◇", color: theme.cyan }
  if (t.includes("write") || t.includes("edit")) return { icon: "✎", color: theme.yellow }
  if (t.includes("bash") || t.includes("shell") || t.includes("execute")) return { icon: "$", color: theme.green }
  return { icon: "⬡", color: theme.pink }
}

function isWriteTool(tool: string) {
  const t = tool.toLowerCase()
  return t.includes("write") || t.includes("edit") || t.includes("patch")
}

function looksLikeDiff(text: string) {
  return text.includes("@@") || text.startsWith("---") || text.startsWith("diff ")
}

interface DiffLineProps {
  row: string
  theme: Theme
}

function DiffLine({ row, theme }: DiffLineProps) {
  if (row.startsWith("+") && !row.startsWith("+++")) return <Text color={theme.green}>{row}</Text>
  if (row.startsWith("-") && !row.startsWith("---")) return <Text color={theme.red}>{row}</Text>
  if (row.startsWith("@@")) return <Text color={theme.cyan}>{row}</Text>
  if (row.startsWith("---") || row.startsWith("+++")) return <Text color={theme.overlay}>{row}</Text>
  return <Text color={theme.subtext}>{row}</Text>
}

// Pure helper: expanded when user explicitly opened (collapsed=false), or auto-expanded
// for errors unless user explicitly closed them (collapsed=true).
// Default (undefined): all non-error tools start collapsed.
export function isOpen(status: string, collapsed: boolean | undefined): boolean {
  if (collapsed === false) return true
  if (collapsed === true) return false
  return status === "error"
}

export const ToolPart = React.memo(function ToolPart({ part }: Props) {
  const theme = useTheme()
  const collapsed = useAppStore((s) => s.collapsedTools[part.id])
  const focusMode = useAppStore((s) => s.focusMode)
  const state = part.state
  const stat = STAT[state.status]
  const kid = kind(part.tool, theme)
  const open = focusMode ? false : isOpen(state.status, collapsed)
  const sum = span(state.input)
  const title = "title" in state && state.title ? state.title : sum ? `${part.tool} ${sum}` : part.tool
  const time = "time" in state ? dur(state.time.start, "end" in state.time ? state.time.end : undefined) : ""
  const maxCols = Math.max(40, (process.stdout.columns ?? 120) - 6)

  return (
    <Box marginTop={0} paddingLeft={3} flexDirection="column" flexShrink={0}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={1}>
          <Text color={theme.overlay}>{open ? "▾" : "▸"}</Text>
          <Text color={theme[stat.color]}>{stat.icon}</Text>
          <Text color={kid.color}>{kid.icon}</Text>
          <Text color={theme.subtext} wrap="truncate-end">
            {title}
          </Text>
        </Box>
        <Text color={theme.overlay}>{time}</Text>
      </Box>
      {open &&
        (state.status === "error" ? (
          <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.red} flexDirection="column">
            <Text wrap="wrap" color={theme.subtext}>
              {truncLines(state.error, maxCols, 30)}
            </Text>
          </Box>
        ) : state.status === "completed" ? (
          (() => {
            if (isWriteTool(part.tool) && looksLikeDiff(state.output)) {
              const rows = state.output.split(/\r?\n/).map((row) => cut(row, maxCols))
              const visible = rows.slice(0, 30)
              const extra = rows.length - visible.length
              return (
                <Box
                  marginTop={1}
                  paddingLeft={1}
                  borderLeft={true}
                  borderColor={theme.surface0}
                  flexDirection="column"
                >
                  {visible.map((row, i) => (
                    <DiffLine key={i} row={row} theme={theme} />
                  ))}
                  {extra > 0 && <Text color={theme.overlay}>… {extra} more lines</Text>}
                </Box>
              )
            }
            return (
              <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.surface0} flexDirection="column">
                <Text wrap="wrap" color={theme.subtext}>
                  {truncLines(state.output, maxCols, 30)}
                </Text>
              </Box>
            )
          })()
        ) : (
          <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.surface0} flexDirection="column">
            <Text wrap="wrap" color={theme.overlay}>
              {truncLines(json(state.input), maxCols, 30)}
            </Text>
          </Box>
        ))}
    </Box>
  )
})
