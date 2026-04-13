import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

export function StatusBar() {
  const theme = useTheme()
  const currentModel = useAppStore((s) => s.currentModel)
  const mode = useAppStore((s) => s.mode)

  const modelDisplay = currentModel ? currentModel.modelID : "no model"

  return (
    <Box height={1} justifyContent="space-between">
      <Box flexDirection="row">
        <Text inverse>{` ${mode} `}</Text>
        <Text color={theme.overlay}> │ </Text>
        <Text color={theme.cyan}>{modelDisplay}</Text>
        <Text color={theme.overlay}> │ </Text>
        <Text color={theme.overlay}>e: tools · shift+tab: mode</Text>
      </Box>
    </Box>
  )
}
