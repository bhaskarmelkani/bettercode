import React from "react"
import { Box, Text } from "ink"
import type { Part, FilePart as FilePartType } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { FileParts } from "./parts/FilePart"
import { MarkdownRenderer } from "./markdown/MarkdownRenderer"

interface Props {
  parts: Part[]
  isQueued?: boolean
}

export function UserMessage({ parts, isQueued }: Props) {
  const theme = useTheme()
  const text = parts.find((p) => p.type === "text" && !(p as any).synthetic) as
    | { type: "text"; text: string }
    | undefined
  const files = parts.filter((p) => p.type === "file") as FilePartType[]

  if (!text) return null

  return (
    <Box
      marginTop={0}
      paddingLeft={3}
      flexShrink={0}
    >
      <Text color={theme.mauve}>●</Text>
      <Box flexDirection="column" paddingLeft={1} paddingTop={0} paddingBottom={0} flexShrink={1}>
        <MarkdownRenderer text={text.text} />
        <FileParts parts={files} />
        {isQueued && (
          <Text color={theme.overlay} dimColor>
            QUEUED
          </Text>
        )}
      </Box>
    </Box>
  )
}
