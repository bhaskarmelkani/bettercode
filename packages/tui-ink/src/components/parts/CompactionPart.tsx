import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

export function CompactionPart() {
  const theme = useTheme()
  return (
    <Box marginTop={1} marginBottom={1} flexShrink={0}>
      <Text color={theme.overlay}>────── context compacted ──────</Text>
    </Box>
  )
}
