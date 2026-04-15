import React from "react"
import { Box, Text } from "ink"
import type { ContextUsage } from "../store"
import { useTheme } from "../theme-context"

const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]

function cut(text: string, max: number) {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

export function progressBar(ratio: number, width: number) {
  if (width <= 0) return ""
  const fill = Math.max(0, Math.min(1, ratio)) * width
  const full = Math.floor(fill)
  const part = Math.round((fill - full) * 8)
  const head = "█".repeat(full)
  const tail = part > 0 && full < width ? (BLOCKS[part] ?? "") : ""
  return `${head}${tail}${" ".repeat(Math.max(0, width - head.length - tail.length))}`
}

function line(width: number, text: string) {
  const body = cut(text, width)
  return `${body}${" ".repeat(Math.max(0, width - body.length))}`
}

export function TokenWarning({ width, usage }: { width: number; usage: ContextUsage }) {
  if (usage.percent < 75) return null

  const theme = useTheme()
  const critical = usage.percent >= 90
  const suggest = usage.percent >= 85
  const remain = Math.max(0, 100 - usage.percent)
  const head = `Context ${critical ? "critical" : "low"} — ${remain}% remaining [`
  const tail = `]${suggest ? " /compact" : ""}`
  const room = width - head.length - tail.length
  const text =
    room >= 6
      ? `${head}${progressBar(usage.percent / 100, Math.min(20, room))}${tail}`
      : `Context ${critical ? "critical" : "low"} — ${remain}% remaining${suggest ? " /compact" : ""}`

  return (
    <Box height={1}>
      <Text color={critical ? theme.red : theme.yellow}>{line(width, text)}</Text>
    </Box>
  )
}
