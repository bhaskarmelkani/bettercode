import React from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import type { Dialog } from "../store"
import { useTheme } from "../theme-context"
import { CommandPalette } from "./CommandPalette"
import { SessionListDialog } from "./SessionListDialog"
import { ProviderDialog } from "./ProviderDialog"
import { ModelPickerDialog } from "./ModelPickerDialog"
import { AgentPickerDialog } from "./AgentPickerDialog"
import { McpDialog } from "./McpDialog"
import { ThemePickerDialog } from "./ThemePickerDialog"
import { HelpDialog } from "./HelpDialog"
import { WorktreePickerDialog } from "./WorktreePickerDialog"

interface Props {
  dialog: Dialog
  rows: number
  columns: number
}

function ConfirmDialog({
  rows,
  columns,
  message,
  onConfirm,
}: {
  rows: number
  columns: number
  message: string
  onConfirm: () => void
}) {
  const theme = useTheme()
  const popDialog = useAppStore((s) => s.popDialog)

  useInput((input, key) => {
    if (key.escape || input === "n" || input === "N") {
      popDialog()
      return
    }
    if (input === "y" || input === "Y" || key.return) {
      onConfirm()
      popDialog()
    }
  })

  const pad = Math.max(0, Math.floor((rows - 6) / 2))

  return (
    <Box height={rows} width={columns} flexDirection="column">
      <Box height={pad} />
      <Box flexDirection="column" alignItems="center">
        <Text color={theme.yellow} bold>
          Confirm
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text}>{message}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.overlay}>y confirm · n/esc cancel</Text>
        </Box>
      </Box>
    </Box>
  )
}

function AlertDialog({
  rows,
  columns,
  title,
  message,
}: {
  rows: number
  columns: number
  title?: string
  message: string
}) {
  const theme = useTheme()
  const popDialog = useAppStore((s) => s.popDialog)

  useInput((_input, key) => {
    if (key.escape || key.return) {
      popDialog()
    }
  })

  const pad = Math.max(0, Math.floor((rows - 6) / 2))

  return (
    <Box height={rows} width={columns} flexDirection="column">
      <Box height={pad} />
      <Box flexDirection="column" alignItems="center">
        <Text color={theme.cyan} bold>
          {title ?? "Notice"}
        </Text>
        <Box marginTop={1} paddingX={4}>
          <Text color={theme.text} wrap="wrap">
            {message}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.overlay}>enter / esc to dismiss</Text>
        </Box>
      </Box>
    </Box>
  )
}

export function DialogOverlay({ dialog, rows, columns }: Props) {
  if (dialog.type === "session-list") {
    return <SessionListDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "command-palette") {
    return <CommandPalette rows={rows} columns={columns} />
  }
  if (dialog.type === "confirm") {
    return <ConfirmDialog rows={rows} columns={columns} message={dialog.message} onConfirm={dialog.onConfirm} />
  }
  if (dialog.type === "provider") {
    return <ProviderDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "model-picker") {
    return <ModelPickerDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "agent-picker") {
    return <AgentPickerDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "mcp") {
    return <McpDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "theme") {
    return <ThemePickerDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "help") {
    return <HelpDialog rows={rows} columns={columns} />
  }
  if (dialog.type === "alert") {
    return <AlertDialog rows={rows} columns={columns} title={dialog.title} message={dialog.message} />
  }
  if (dialog.type === "worktree-picker") {
    return <WorktreePickerDialog rows={rows} columns={columns} />
  }
  return null
}
