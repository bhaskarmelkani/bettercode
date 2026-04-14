import React from "react"
import { Box, Text } from "ink"
import type { TextPart as TextPartSDK } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../theme-context"
import { MarkdownRenderer } from "../markdown/MarkdownRenderer"

interface Props {
  part: TextPartSDK
  lead?: string
}

export const TextPart = React.memo(function TextPart({ part, lead }: Props) {
  const theme = useTheme()
  const text = part.text
  if (!text.trim()) return null
  return (
    <Box marginTop={0} paddingLeft={3} flexDirection="row" gap={1} flexShrink={0}>
      {lead ? <Text color={theme.lavender}>{lead}</Text> : null}
      <Box flexDirection="column" flexShrink={1}>
        <MarkdownRenderer text={text} />
      </Box>
    </Box>
  )
})
