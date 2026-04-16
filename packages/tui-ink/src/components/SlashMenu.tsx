import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"

const LIMIT = 6

export interface SlashCommand {
  name: string
  description: string
  source?: "local" | "command" | "mcp" | "skill"
  hints?: string[]
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
  const cmdWidth = Math.min(16, Math.max(8, ...visible.map((cmd) => cmd.name.length + 1)))
  const tag = (cmd: SlashCommand) =>
    cmd.source === "mcp" ? "MCP" : cmd.source === "skill" ? "SKILL" : cmd.source === "command" ? "CMD" : "LOCAL"
  const tagColor = (cmd: SlashCommand) =>
    cmd.source === "mcp" ? theme.green : cmd.source === "skill" ? theme.mauve : cmd.source === "command" ? theme.blue : theme.overlay

  return (
    <Box width={width} marginTop={-visible.length} flexDirection="column">
      {visible.map((cmd, i) => {
        const real = start + i
        const sel = real === focused
        const prefix = sel ? "▶" : " "
        const name = `/${cmd.name}`.padEnd(cmdWidth, " ")
        const kind = `[${tag(cmd)}]`
        const hints = cmd.hints?.join(" ") ?? ""
        const meta = `${kind}${hints ? ` ${hints}` : ""}`
        const left = ` ${prefix} ${name}  `
        // Reserve 3 extra chars when computing desc space (instead of 2) to ensure
        // the row total stays at width-1, preventing Ink from wrapping bold rows.
        const space = Math.max(0, width - left.length - meta.length - 3)
        const desc = cut(cmd.description, space)
        const fill = Math.max(0, width - left.length - desc.length - meta.length - 1)
        return (
          <Box key={cmd.name} flexDirection="row">
            <Text color={sel ? theme.cyan : theme.overlay}>{` ${prefix} `}</Text>
            <Text color={sel ? theme.text : theme.subtext} bold={sel}>
              {name}
            </Text>
            <Text color={sel ? theme.text : theme.subtext}>{"  "}</Text>
            <Text color={sel ? theme.text : theme.subtext}>{desc}</Text>
            {fill > 0 ? <Text>{" ".repeat(fill)}</Text> : null}
            <Text color={tagColor(cmd)}>{kind}</Text>
            {hints ? <Text color={theme.overlay}>{` ${hints}`}</Text> : null}
          </Box>
        )
      })}
    </Box>
  )
}

function cut(s: string, n: number) {
  if (n <= 0) return ""
  if (s.length <= n) return s
  if (n <= 3) return s.slice(0, n)
  return s.slice(0, n - 3) + "..."
}
