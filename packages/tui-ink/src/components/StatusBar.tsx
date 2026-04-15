import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

interface Props {
  width: number
  sidebarOpen?: boolean
}

function cut(text: string, max: number) {
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

export function StatusBar({ width, sidebarOpen }: Props) {
  const theme = useTheme()
  const model = useAppStore((s) => s.currentModel)
  const agent = useAppStore((s) => s.mode)
  const vcs = useAppStore((s) => s.vcs)
  const sid = useAppStore((s) => s.currentSessionID)
  const composerStatus = useAppStore((s) => s.composerStatus)
  const session = useAppStore((s) => s.sessionStatus[sid])
  const dlg = useAppStore((s) => s.dialogs.length > 0)
  const scroll = useAppStore((s) => s.scrollPos[sid] ?? 0)
  const perms = useAppStore((s) => (s.permissions[sid]?.length ?? 0) > 0)
  const qs = useAppStore((s) => (s.questions[sid]?.length ?? 0) > 0)
  const autoAccept = useAppStore((s) => s.autoAcceptPermissions)
  const focusMode = useAppStore((s) => s.focusMode)
  const searchMode = useAppStore((s) => s.searchMode)
  const edits = useAppStore((s) =>
    (s.messages[sid] ?? []).some((msg) => msg.role === "assistant" && (s.messageDiff[msg.id]?.length ?? 0) > 0),
  )

  const branch = cut(vcs?.branch ?? "—", 28)
  const display = cut(model ? model.modelID : "no model", 24)
  const generating = session?.type === "busy" || composerStatus === "generating"
  const tone = agent === "plan" ? theme.yellow : theme.blue
  const mode = "shift + tab"
  const raw = focusMode
    ? "ctrl+o: exit focus"
    : searchMode
      ? "enter/ctrl+n: next · ctrl+p: prev · esc: close"
      : perms
        ? "y: allow · a: allow all · n: deny"
        : qs
          ? "↑↓: navigate · enter: select · esc: reject"
          : dlg
            ? "esc: close · tab: navigate"
            : sidebarOpen
              ? "tab/←→: sidebar · ctrl+b: close"
              : generating
                ? "↑↓ scroll · ctrl+c abort"
                : edits
                  ? "ctrl+g: expand/collapse edits · ctrl+b: capabilities"
                  : scroll > 0
                    ? "ctrl+↓: snap bottom"
                    : "ctrl+k: commands · /: slash · ctrl+b: capabilities"

  // fixed = " "(2) + git + " · "(3) + agent + " (" + mode + ")" + " · "(3) + display + " · "(3)
  const fixed = 2 + 2 + branch.length + 3 + agent.length + 2 + mode.length + 1 + 3 + display.length + 3
  const hint = cut(raw, Math.max(0, width - fixed))
  const fill = Math.max(0, width - fixed - hint.length)

  return (
    <Box height={1} flexDirection="row">
      <Text color={theme.overlay}> </Text>
      <Text color={theme.overlay}>{"⎇ "}</Text>
      <Text color={theme.cyan}>{branch}</Text>
      <Text color={theme.overlay}>{" · "}</Text>
      <Text color={tone} bold>
        {agent}
      </Text>
      <Text color={theme.overlay}>{` (${mode})`}</Text>
      <Text color={theme.overlay}>{" · "}</Text>
      <Text color={theme.subtext}>{display}</Text>
      <Text color={theme.overlay}>{" · "}</Text>
      <Text color={theme.overlay}>{hint}</Text>
      {fill > 0 ? <Text>{" ".repeat(fill)}</Text> : null}
      {autoAccept && <Text color={theme.yellow}>{" auto-accept "}</Text>}
    </Box>
  )
}
