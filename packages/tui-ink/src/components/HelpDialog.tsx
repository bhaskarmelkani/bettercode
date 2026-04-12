import React from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { useCommands } from "../commands/useCommands"

interface Props {
  rows: number
  columns: number
}

export function HelpDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const popDialog = useAppStore((s) => s.popDialog)
  const cmds = useCommands()

  // Group by category
  const byCategory: Record<string, typeof cmds> = {}
  for (const cmd of cmds) {
    if (cmd.enabled === false) continue
    if (!byCategory[cmd.category]) byCategory[cmd.category] = []
    byCategory[cmd.category]!.push(cmd)
  }

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "k") || input === "q" || input === "?") {
      popDialog()
    }
  })

  const categories = Object.keys(byCategory).sort()
  const maxVisible = Math.max(1, rows - 6)
  let count = 0

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          Keyboard Shortcuts
        </Text>
      </Box>

      <Box flexDirection="column" height={maxVisible} overflow="hidden">
        {categories.flatMap((cat) => {
          const catCmds = byCategory[cat] ?? []
          const items: React.ReactNode[] = [
            <Box key={`cat-${cat}`} marginTop={count > 0 ? 1 : 0}>
              <Text color={theme.overlay} bold>
                {cat}
              </Text>
            </Box>,
          ]
          for (const cmd of catCmds) {
            if (count >= maxVisible - 2) break
            items.push(
              <Box key={cmd.id} paddingLeft={2} flexDirection="row">
                <Box width={20}>
                  <Text color={theme.subtext}>{cmd.label}</Text>
                </Box>
                <Box width={16}>
                  {cmd.keybind ? (
                    <Text color={theme.cyan}>{cmd.keybind}</Text>
                  ) : cmd.slash ? (
                    <Text color={theme.surface2}>{"/" + cmd.slash}</Text>
                  ) : (
                    <Text color={theme.surface2}>—</Text>
                  )}
                </Box>
                {cmd.description && (
                  <Text color={theme.overlay} wrap="truncate">
                    {cmd.description}
                  </Text>
                )}
              </Box>,
            )
            count++
          }
          return items
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.overlay}>q / esc / ? to close</Text>
      </Box>
    </Box>
  )
}
