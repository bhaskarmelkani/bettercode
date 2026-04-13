import React, { useEffect } from "react"
import { Box, Text } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import type { Toast } from "../store"

function ToastItem({ toast }: { toast: Toast }) {
  const theme = useTheme()
  const removeToast = useAppStore((s) => s.removeToast)

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
    <Box borderStyle="single" borderColor={color} paddingX={1} marginBottom={0} flexDirection="row" gap={1}>
      <Text color={color}>{icon}</Text>
      <Box flexDirection="column">
        {toast.title && (
          <Text color={color} bold>
            {toast.title}
          </Text>
        )}
        <Text color={theme.text}>{toast.message}</Text>
      </Box>
    </Box>
  )
}

export function ToastOverlay() {
  const toasts = useAppStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <Box flexDirection="column" flexShrink={0}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </Box>
  )
}
