import React from "react"
import { Text } from "ink"
import { useTheme } from "../../theme-context"
import type { Theme } from "../../theme"

interface Props {
  keys: string | string[]
  label?: string
  tone?: keyof Theme
}

export function hintText(keys: string | string[], label?: string) {
  const head = Array.isArray(keys) ? keys.join(" + ") : keys
  if (!label) return head
  return `${head}: ${label}`
}

export function KeyboardShortcutHint({ keys, label, tone = "overlay" }: Props) {
  const theme = useTheme()
  return <Text color={theme[tone]}>{hintText(keys, label)}</Text>
}
