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
    <Box marginTop={0} flexDirection="column" flexShrink={0}>
      <Box borderStyle="round" borderColor={theme.surface1} flexDirection="column" paddingX={1}>
        <Text color={theme.overlay} dimColor>
          {lang || "text"}
        </Text>
        <Text color={theme.subtext} wrap="wrap">
          {code}
        </Text>
      </Box>
    </Box>
  )
}
