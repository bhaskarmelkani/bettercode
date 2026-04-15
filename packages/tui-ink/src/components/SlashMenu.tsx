import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"

const LIMIT = 6

export interface SlashCommand {
  name: string
  description: string
}

interface Props {
  width: number
  options: SlashCommand[]
  focused: number
}

export function slashWin(total: number, idx: number, size = LIMIT) {
  if (total <= 0) return { start: 0, end: 0 }
  if (total <= size) return { start: 0, end: total }
  const half = Math.floor(size / 2)
  const start = Math.max(0, Math.min(idx - half, total - size))
  return { start, end: start + size }
}

export function SlashMenu({ width, options, focused }: Props) {
  const theme = useTheme()
  if (options.length === 0) return null
  const { start, end } = slashWin(options.length, focused)
  const visible = options.slice(start, end)
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
        const real = start + i
        const sel = real === focused
        const prefix = `${sel ? "▶" : " "}`
        const name = `/${cmd.name}`.padEnd(cmdWidth, " ")
        const space = Math.max(0, width - 5 - cmdWidth)
        const desc = cut(cmd.description, space)
        const body = ` ${prefix} ${name}  ${desc}`.padEnd(width)
        return (
          <Text
            key={cmd.name}
            backgroundColor={sel ? theme.surface1 : theme.surface0}
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
