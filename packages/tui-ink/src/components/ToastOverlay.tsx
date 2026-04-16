import React, { useEffect } from "react"
import { Box, Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import type { Toast } from "../store"

function ToastItem({ toast }: { toast: Toast }) {
  const theme = useTheme()

  const color = {
    info: theme.blue,
    success: theme.green,
    warning: theme.yellow,
    error: theme.red,
  }[toast.variant]

  const icon = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✗",
  }[toast.variant]

  return (
    <Box flexDirection="row" gap={1} paddingLeft={1}>
      <Text color={color} bold>
        {icon}
      </Text>
      {toast.title && (
        <Text color={color} bold>
          {toast.title}
        </Text>
      )}
      {toast.title && toast.message && <Text color={theme.overlay}>·</Text>}
      {toast.message && <Text color={theme.subtext}>{toast.message}</Text>}
    </Box>
  )
}

export function ToastOverlay() {
  const toasts = useAppStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <Box width="100%" flexDirection="row" justifyContent="flex-end" flexShrink={0}>
      <Box flexDirection="column" alignItems="flex-end">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </Box>
    </Box>
  )
}
