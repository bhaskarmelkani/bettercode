import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

interface Props {
  lang?: string
  code: string
}

export function CodeBlock({ lang, code }: Props) {
  const theme = useTheme()

  return (
    <Box marginTop={1} flexDirection="column" flexShrink={0}>
      <Box borderStyle="single" borderColor={theme.surface2} flexDirection="column">
        <Box justifyContent="space-between" paddingX={1}>
          <Text color={theme.mauve} bold>
            {lang || "text"}
          </Text>
          <Text color={theme.overlay} dimColor>
            code
          </Text>
        </Box>
        <Box paddingX={1} paddingBottom={1} flexDirection="column">
          <Text color={theme.text} wrap="wrap">
            {code}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
