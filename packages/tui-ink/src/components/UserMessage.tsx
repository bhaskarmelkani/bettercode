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
      marginTop={1}
      paddingLeft={2}
      paddingRight={1}
      flexShrink={0}
      borderLeft={true}
      borderColor={theme.cyan}
    >
      <Box flexDirection="column" paddingLeft={1} paddingTop={0} paddingBottom={0} flexShrink={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={theme.cyan}>•</Text>
          <Box flexDirection="column" flexShrink={1}>
            <MarkdownRenderer text={text.text} />
            <FileParts parts={files} />
            {isQueued && (
              <Text color={theme.overlay} dimColor>
                QUEUED
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
