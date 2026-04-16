import React from "react"
import { Text } from "ink"
import type { Theme } from "../../theme"
import { useTheme } from "../../theme-context"

const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]

export function progressBar(ratio: number, width: number) {
  if (width <= 0) return ""
  const fill = Math.max(0, Math.min(1, ratio)) * width
  const full = Math.floor(fill)
  const part = Math.round((fill - full) * 8)
  const head = "█".repeat(full)
  const tail = part > 0 && full < width ? (BLOCKS[part] ?? "") : ""
  return `${head}${tail}${" ".repeat(Math.max(0, width - head.length - tail.length))}`
}

interface Props {
  ratio: number
  width: number
  tone?: keyof Theme
}

export function ProgressBar({ ratio, width, tone = "yellow" }: Props) {
  const theme = useTheme()
  return <Text color={theme[tone]}>{progressBar(ratio, width)}</Text>
}
