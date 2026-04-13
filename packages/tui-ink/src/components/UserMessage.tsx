import React from "react"
import { Box, Text } from "ink"
import type { Message, Part, FilePart as FilePartType } from "@opencode-ai/sdk/v2"
import { useTheme } from "../theme-context"
import { FileParts } from "./parts/FilePart"

interface Props {
  message: Message
  parts: Part[]
  isQueued?: boolean
}

export function UserMessage({ message, parts, isQueued }: Props) {
  const theme = useTheme()
  const text = parts.find((p) => p.type === "text" && !(p as any).synthetic) as
    | { type: "text"; text: string }
    | undefined
  const files = parts.filter((p) => p.type === "file") as FilePartType[]

  if (!text) return null

  return (
    <Box
      marginTop={1}
      borderStyle="single"
      borderLeft={true}
      borderRight={false}
      borderTop={false}
      borderBottom={false}
      borderColor={theme.mauve}
      paddingLeft={1}
      flexShrink={0}
    >
      <Box flexDirection="column" paddingLeft={1} paddingTop={1} paddingBottom={1}>
        <Text wrap="wrap" color={theme.text}>
          {text.text}
        </Text>
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
