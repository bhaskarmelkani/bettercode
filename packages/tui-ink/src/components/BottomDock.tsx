import React from "react"
import { Box, Text } from "ink"
import type { FilePartInput, PermissionRequest, QuestionRequest } from "@opencode-ai/sdk/v2"
import type { Dialog } from "../store"
import { useTheme } from "../theme-context"
import { Composer } from "./Composer"
import { CommandPalette } from "./CommandPalette"
import { SessionListDialog } from "./SessionListDialog"
import { ProviderDialog } from "./ProviderDialog"
import { ModelPickerDialog } from "./ModelPickerDialog"
import { AgentPickerDialog } from "./AgentPickerDialog"
import { McpDialog } from "./McpDialog"
import { ThemePickerDialog } from "./ThemePickerDialog"
import { PermissionPrompt } from "./PermissionPrompt"
import { QuestionPrompt } from "./QuestionPrompt"

const PANELS = new Set(["command-palette", "session-list", "provider", "model-picker", "agent-picker", "mcp", "theme"])

const base = 4
const perm = 5
const quest = 7
const paneRows = 15

export function dockHeight(input: {
  rows: number
  dialog?: Dialog
  permissions?: PermissionRequest[]
  questions?: QuestionRequest[]
  inputLines?: number
}) {
  if (input.dialog && PANELS.has(input.dialog.type)) {
    return Math.max(1, Math.min(input.rows - 3, paneRows))
  }
  if (input.permissions?.length) return Math.max(1, Math.min(input.rows - 3, base + perm))
  if (input.questions?.length) return Math.max(1, Math.min(input.rows - 3, base + quest))
  // base + extra rows for each additional input line (capped at 14 extra = 15 visible lines)
  const extra = Math.max(0, Math.min(14, (input.inputLines ?? 1) - 1))
  return Math.max(1, Math.min(input.rows - 3, base + extra))
}

interface Props {
  dialog?: Dialog
  rows: number
  columns: number
  active: boolean
  generating: boolean
  onSubmit: (text: string, files?: FilePartInput[]) => void | Promise<void>
  onAbort: () => void
  permissions?: PermissionRequest[]
  questions?: QuestionRequest[]
}

function pane(dialog: Dialog, rows: number, columns: number) {
  if (dialog.type === "command-palette") return <CommandPalette rows={rows} columns={columns} />
  if (dialog.type === "session-list") return <SessionListDialog rows={rows} columns={columns} />
  if (dialog.type === "provider") return <ProviderDialog rows={rows} columns={columns} />
  if (dialog.type === "model-picker") return <ModelPickerDialog rows={rows} columns={columns} />
  if (dialog.type === "agent-picker") return <AgentPickerDialog rows={rows} columns={columns} />
  if (dialog.type === "mcp") return <McpDialog rows={rows} columns={columns} />
  if (dialog.type === "theme") return <ThemePickerDialog rows={rows} columns={columns} />
  return null
}

export function BottomDock({
  dialog,
  rows,
  columns,
  active,
  generating,
  onSubmit,
  onAbort,
  permissions,
  questions,
}: Props) {
  const theme = useTheme()
  const dlg = dialog && PANELS.has(dialog.type) ? dialog : undefined
  const height = rows

  if (dlg) {
    const inner = height - 1
    return (
      <Box flexDirection="column" height={height} width={columns}>
        <Text color={theme.surface1}>{"─".repeat(columns)}</Text>
        <Box height={inner} width={columns} flexDirection="column">
          {pane(dlg, inner, columns)}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" height={height} width={columns}>
      {permissions?.length ? <PermissionPrompt request={permissions[0]!} columns={columns} /> : null}
      {!permissions?.length && questions?.length ? <QuestionPrompt request={questions[0]!} columns={columns} /> : null}
      <Composer onSubmit={onSubmit} onAbort={onAbort} active={active} generating={generating} width={columns} />
    </Box>
  )
}
