import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

export function StatusBar() {
  const theme = useTheme()
  const currentModel = useAppStore((s) => s.currentModel)
  const currentAgent = useAppStore((s) => s.currentAgent)

  return (
    <Box height={1} justifyContent="space-between">
      <Text color={theme.subtext}> ctrl+c exit ctrl+n new ctrl+k commands </Text>
      <Box>
        {currentAgent && <Text color={theme.lavender}>{currentAgent} </Text>}
        {currentModel && (
          <Text color={theme.cyan}>
            {currentModel.providerID}/{currentModel.modelID}{" "}
          </Text>
        )}
        <Text color={theme.overlay}>bettercode v0.0.1 </Text>
      </Box>
    </Box>
  )
}
