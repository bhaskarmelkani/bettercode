import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

export function StatusBar() {
  const theme = useTheme()
  const currentModel = useAppStore((s) => s.currentModel)
  const agent = useAppStore((s) => s.mode)
  const currentSessionID = useAppStore((s) => s.currentSessionID)
  const composerStatus = useAppStore((s) => s.composerStatus)
  const session = useAppStore((s) => s.sessionStatus[currentSessionID])

  const modelDisplay = currentModel ? currentModel.modelID : "no model"
  const generating = session?.type === "busy" || composerStatus === "generating"
  const hint = generating ? "↑↓ scroll · e: tools · ctrl+c abort" : "ctrl+k: commands · ctrl+s: sessions · shift+tab: agent"
  const pill = agent === "plan" ? theme.yellow : theme.blue

  return (
    <Box height={1} justifyContent="space-between">
      <Box flexDirection="row">
        <Text color={theme.overlay}>primary agent</Text>
        <Text color={theme.overlay}> │ </Text>
        <Text backgroundColor={pill} color={theme.base}>{` ${agent} `}</Text>
        <Text color={theme.overlay}> │ </Text>
        <Text color={theme.cyan}>{modelDisplay}</Text>
        <Text color={theme.overlay}> │ </Text>
        <Text color={theme.overlay}>{hint}</Text>
      </Box>
    </Box>
  )
}
