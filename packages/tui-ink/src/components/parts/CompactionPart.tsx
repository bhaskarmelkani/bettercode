import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

export function CompactionPart() {
  const theme = useTheme()
  return (
    <Box marginTop={1} marginBottom={0} flexShrink={0}>
      <Text color={theme.surface2}>• context compacted</Text>
    </Box>
  )
}
