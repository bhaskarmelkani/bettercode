import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"

export interface SlashCommand {
  name: string
  description: string
}

interface Props {
  width: number
  options: SlashCommand[]
  focused: number
}

export function SlashMenu({ width, options, focused }: Props) {
  const theme = useTheme()
  if (options.length === 0) return null
  const visible = options.slice(0, 6)
  const cut = (s: string, n: number) => {
    if (n <= 0) return ""
    if (s.length <= n) return s
    if (n <= 3) return s.slice(0, n)
    return s.slice(0, n - 3) + "..."
  }
  const cmdWidth = Math.min(14, Math.max(8, ...visible.map((cmd) => cmd.name.length + 1)))

  return (
    <Box position="absolute" width={width} marginTop={-visible.length} flexDirection="column">
      {visible.map((cmd, i) => {
        const sel = i === focused
        const prefix = `${sel ? "▶" : " "}`
        const name = `/${cmd.name}`.padEnd(cmdWidth, " ")
        const space = Math.max(0, width - 3 - cmdWidth)
        const desc = cut(cmd.description, space)
        const body = ` ${prefix} ${name}  ${desc}`.padEnd(Math.max(0, width), " ")
        return (
          <Text
            key={cmd.name}
            backgroundColor={sel ? theme.surface2 : theme.mantle}
            color={sel ? theme.text : theme.subtext}
            wrap="truncate-end"
          >
            {body}
          </Text>
        )
      })}
    </Box>
  )
}
