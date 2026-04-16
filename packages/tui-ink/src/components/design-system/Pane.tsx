import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

interface Props {
  title: string
  rows?: number
  columns?: number
  meta?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Pane({ title, rows, columns, meta, footer, children }: Props) {
  const theme = useTheme()

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          {title}
        </Text>
        {meta}
      </Box>

      <Box flexDirection="column">{children}</Box>

      {footer ? <Box marginTop={1}>{footer}</Box> : null}
    </Box>
  )
}
