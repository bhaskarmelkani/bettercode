import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../theme-context"

interface Props {
  label: string
  selected?: boolean
  active?: boolean
  indent?: number
  marker?: string
  lead?: string
  idle?: string
  tail?: React.ReactNode
  detail?: React.ReactNode
}

export function ListItem({ label, selected, active, indent = 0, marker, lead = "▶ ", idle = "  ", tail, detail }: Props) {
  const theme = useTheme()
  const tone = active ? theme.green : selected ? theme.text : theme.subtext

  return (
    <Box flexDirection="column">
      <Box paddingLeft={indent} flexDirection="row">
        <Text color={selected ? theme.cyan : theme.overlay}>{selected ? lead : idle}</Text>
        {marker ? <Text color={theme.overlay}>{marker}</Text> : null}
        <Text color={tone} bold={selected}>
          {label}
        </Text>
        {tail}
      </Box>
      {detail ? <Box paddingLeft={indent + 4}>{detail}</Box> : null}
    </Box>
  )
}
