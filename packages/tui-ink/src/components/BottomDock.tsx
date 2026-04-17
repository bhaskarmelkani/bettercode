import React from "react"
import { Box, Text, useInput } from "ink"
import type { FilePartInput, PermissionRequest, QuestionRequest } from "@opencode-ai/sdk/v2"
import type { Dialog, PromptQueueItem } from "../store"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { Composer } from "./Composer"
import { PromptQueue, queueRows } from "./PromptQueue"
import { CommandPalette } from "./CommandPalette"
import { SessionListDialog } from "./SessionListDialog"
import { ProviderDialog } from "./ProviderDialog"
import { ModelPickerDialog } from "./ModelPickerDialog"
import { AgentPickerDialog } from "./AgentPickerDialog"
import { McpDialog } from "./McpDialog"
import { ThemePickerDialog } from "./ThemePickerDialog"
import { HelpDialog } from "./HelpDialog"
import { PermissionPrompt } from "./PermissionPrompt"
import { Dialog as ShellDialog } from "./design-system"

const PANELS = new Set([
  "command-palette",
  "session-list",
  "provider",
  "model-picker",
  "agent-picker",
  "mcp",
  "theme",
  "help",
  "alert",
])

const base = 4
const perm = 4  // compact permission prompt: 4 rows (title+pattern+summary+actions) + 2 border = 6 rows total; base handles the composer below
const paneRows = 15

export function dockHeight(input: {
  rows: number
  dialog?: Dialog
  permissions?: PermissionRequest[]
  questions?: QuestionRequest[]
  inputLines?: number
  queueLength?: number
}) {
  if (input.dialog && PANELS.has(input.dialog.type)) {
    return Math.max(1, Math.min(input.rows - 3, paneRows))
  }
  if (input.permissions?.length) return Math.max(1, Math.min(input.rows - 3, base + perm))
  if (input.questions?.length) {
    const q = input.questions[0]?.questions[0]
    // 1 header row + option rows (named + optional custom) — base covers separator + hint
    const opts = (q?.options?.length ?? 0) + (q?.custom !== false ? 1 : 0)
    return Math.max(1, Math.min(input.rows - 3, base + 1 + opts))
  }
  // base + extra rows for each additional input line (capped at 14 extra = 15 visible lines)
  const extra = Math.max(0, Math.min(14, (input.inputLines ?? 1) - 1))
  const queue = queueRows(input.queueLength ?? 0)
  return Math.max(1, Math.min(input.rows - 3, base + extra + queue))
}

interface Props {
  dialog?: Dialog
  rows: number
  columns: number
  active: boolean
  generating: boolean
  onSubmit: (text: string, files?: FilePartInput[]) => void | Promise<void>
  onAbort: () => void
  onSteer?: (text: string, files?: FilePartInput[]) => void
  permissions?: PermissionRequest[]
  questions?: QuestionRequest[]
  queue?: PromptQueueItem[]
  onDequeue?: (id: string) => void
  onClearQueue?: () => void
}

function AlertPane({
  dialog,
  rows,
  columns,
}: {
  dialog: Extract<Dialog, { type: "alert" }>
  rows: number
  columns: number
}) {
  const theme = useTheme()
  const popDialog = useAppStore((s) => s.popDialog)
  useInput((input, key) => {
    if (key.escape || input === "q" || key.return) popDialog()
  })
  return (
    <ShellDialog title={dialog.title ?? "Notice"} rows={rows} columns={columns} footer="enter / esc to close">
      <Text color={theme.subtext} wrap="wrap">
        {dialog.message}
      </Text>
    </ShellDialog>
  )
}

function pane(dialog: Dialog, rows: number, columns: number) {
  if (dialog.type === "command-palette") return <CommandPalette rows={rows} columns={columns} />
  if (dialog.type === "session-list") return <SessionListDialog rows={rows} columns={columns} />
  if (dialog.type === "provider") return <ProviderDialog rows={rows} columns={columns} />
  if (dialog.type === "model-picker") return <ModelPickerDialog rows={rows} columns={columns} />
  if (dialog.type === "agent-picker") return <AgentPickerDialog rows={rows} columns={columns} />
  if (dialog.type === "mcp") return <McpDialog rows={rows} columns={columns} />
  if (dialog.type === "theme") return <ThemePickerDialog rows={rows} columns={columns} />
  if (dialog.type === "help") return <HelpDialog rows={rows} columns={columns} />
  if (dialog.type === "alert") return <AlertPane dialog={dialog} rows={rows} columns={columns} />
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
  onSteer,
  permissions,
  questions,
  queue,
  onDequeue,
  onClearQueue,
}: Props) {
  const theme = useTheme()
  const dlg = dialog && PANELS.has(dialog.type) ? dialog : undefined
  const height = rows
  const blocked = !!permissions?.length

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

  const showQueue = !permissions?.length && !questions?.length && !!queue?.length
  return (
    <Box flexDirection="column" height={height} width={columns}>
      {permissions?.length ? <PermissionPrompt request={permissions[0]!} columns={columns} /> : null}
      {showQueue && <PromptQueue items={queue!} width={columns} />}
      <Composer
        onSubmit={onSubmit}
        onAbort={onAbort}
        onSteer={onSteer}
        active={active}
        generating={blocked ? false : generating}
        width={columns}
        question={questions?.[0]}
      />
    </Box>
  )
}
