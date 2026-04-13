import React from "react"
import { Box, Text } from "ink"
import type { ReasoningPart } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"

interface Props {
  part: ReasoningPart
  visible: boolean
}

export function ReasoningPart({ part, visible }: Props) {
  const theme = useTheme()
  if (!visible) return null
  const text = part.text.replace("[REDACTED]", "").trim()
  if (!text) return null
  return (
    <Box
      marginTop={1}
      paddingLeft={1}
      borderLeft={true}
      borderColor={theme.lavender}
      flexDirection="column"
      flexShrink={0}
    >
      <Text color={theme.mauve} italic>
        Thinking:
      </Text>
      <Text wrap="wrap" color={theme.subtext}>
        {text}
      </Text>
    </Box>
  )
}
