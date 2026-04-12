import React from "react"
import { Box, Text } from "ink"
import { theme } from "../theme"

export function StatusBar() {
  return (
    <Box height={1} justifyContent="space-between">
      <Text color={theme.subtext}> ctrl+c exit ctrl+n new session enter send </Text>
      <Text color={theme.overlay}>bettercode v0.0.1 </Text>
    </Box>
  )
}
