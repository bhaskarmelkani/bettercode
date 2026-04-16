import React from "react"
import { Box, Text } from "ink"
import type { ContextUsage } from "../store"
import { useTheme } from "../theme-context"
import { progressBar as fill } from "./design-system"

function cut(text: string, max: number) {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

export const progressBar = fill

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
