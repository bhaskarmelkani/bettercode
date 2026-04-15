import React from "react"
import { Box, Text } from "ink"
import type { Part, FilePart as FilePartType, TextPart as TextPartType } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { FileParts } from "./parts/FilePart"
import { MarkdownRenderer } from "./markdown/MarkdownRenderer"

interface Props {
  parts: Part[]
  isQueued?: boolean
  highlight?: boolean
}

export const UserMessage = React.memo(function UserMessage({ parts, isQueued, highlight }: Props) {
  const theme = useTheme()
  const text = parts.find((p): p is TextPartType => p.type === "text" && !p.synthetic)
  const files = parts.filter((p) => p.type === "file") as FilePartType[]

  if (!text) return null

  return (
    <Box
      marginTop={1}
      paddingLeft={1}
      flexShrink={0}
      borderLeft={true}
      borderColor={highlight ? theme.yellow : theme.cyan}
      flexDirection="row"
      gap={1}
    >
      <Text bold color={theme.cyan}>
        ●
      </Text>
      <Box flexDirection="column" flexShrink={1}>
        <MarkdownRenderer text={text.text} bold={true} />
        <FileParts parts={files} />
        {isQueued && (
          <Text color={theme.overlay} dimColor>
            QUEUED
          </Text>
        )}
      </Box>
    </Box>
  )
})
