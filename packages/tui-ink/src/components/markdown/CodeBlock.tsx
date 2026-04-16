import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

interface Props {
  lang?: string
  code: string
}

export function CodeBlock({ lang, code }: Props) {
  const theme = useTheme()
  const label = lang || "text"

  return (
    <Box marginTop={1} flexDirection="column" flexShrink={0}>
      <Box borderLeft borderColor={theme.surface1} paddingLeft={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text backgroundColor={theme.surface1} color={theme.mauve} bold>
            {` ${label} `}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color={theme.text} wrap="wrap">
            {code}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
