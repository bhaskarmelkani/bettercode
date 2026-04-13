import React from "react"
import { Box, Text } from "ink"
import type { TextPart } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"

interface Props {
  part: TextPart
}

export function TextPart({ part }: Props) {
  const theme = useTheme()
  const text = part.text.trim()
  if (!text) return null
  return (
    <Box paddingLeft={3} marginTop={1} flexDirection="column" flexShrink={0}>
      <Text wrap="wrap" color={theme.text}>
        {text}
      </Text>
    </Box>
  )
}
