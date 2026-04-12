import React from "react"
import { Box, Text } from "ink"
import { theme } from "../theme"

interface ContextPaneProps {
  files: string[]
  width: number
  height: number
}

export function ContextPane({ files, width, height }: ContextPaneProps) {
  return (
    <Box flexDirection="column" width={width} height={height} paddingLeft={1}>
      <Text color={theme.subtext} bold>
        Context
      </Text>
      {files.length === 0 ? (
        <Text color={theme.overlay} dimColor>
          No files in context
        </Text>
      ) : (
        files.map((f, i) => (
          <Text key={i} color={theme.subtext} wrap="truncate-end">
            {f}
          </Text>
        ))
      )}
    </Box>
  )
}
