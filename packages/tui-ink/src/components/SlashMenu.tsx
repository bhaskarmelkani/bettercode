import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"

export interface SlashCommand {
  name: string
  description: string
}

interface Props {
  query: string
  options: SlashCommand[]
  focused: number
  onSelect: (cmd: SlashCommand) => void
}

export function SlashMenu({ query, options, focused }: Props) {
  const theme = useTheme()
  if (options.length === 0) return null
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      {options.map((cmd, i) => (
        <Box key={cmd.name} flexDirection="row" gap={1}>
          <Text color={i === focused ? theme.cyan : theme.overlay}>{i === focused ? "▶" : " "}</Text>
          <Text color={i === focused ? theme.text : theme.subtext}>/{cmd.name}</Text>
          <Text color={theme.overlay}>{cmd.description}</Text>
        </Box>
      ))}
    </Box>
  )
}
