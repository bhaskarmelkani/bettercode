import React from "react"
import { Text } from "ink"
import { useTheme } from "../../theme-context"
import type { Theme } from "../../theme"

interface Props {
  label?: string
  width?: number
  tone?: keyof Theme
  bold?: boolean
}

export function Divider({ label, width, tone = "surface2", bold }: Props) {
  const theme = useTheme()
  if (!label) return <Text color={theme[tone]}>{width ? "─".repeat(Math.max(0, width)) : "──"}</Text>

  const text = `── ${label} ──`
  if (!width || text.length >= width) {
    return (
      <Text color={theme[tone]} bold={bold}>
        {text}
      </Text>
    )
  }

  const gap = width - text.length
  const left = Math.floor(gap / 2)
  const right = gap - left

  return (
    <Text color={theme[tone]} bold={bold}>
      {"─".repeat(left)}
      {text}
      {"─".repeat(right)}
    </Text>
  )
}
