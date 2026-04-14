import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"

export function StatusBar() {
  const theme = useTheme()
  const model = useAppStore((s) => s.currentModel)
  const agent = useAppStore((s) => s.mode)
  const sid = useAppStore((s) => s.currentSessionID)
  const composerStatus = useAppStore((s) => s.composerStatus)
  const session = useAppStore((s) => s.sessionStatus[sid])
  const dlg = useAppStore((s) => s.dialogs.length > 0)
  const scroll = useAppStore((s) => s.scrollPos[sid] ?? 0)
  const perms = useAppStore((s) => (s.permissions[sid]?.length ?? 0) > 0)
  const qs = useAppStore((s) => (s.questions[sid]?.length ?? 0) > 0)

  const display = model ? model.modelID : "no model"
  const generating = session?.type === "busy" || composerStatus === "generating"
  const pill = agent === "plan" ? theme.yellow : theme.blue
  const bg = theme.mantle

  const hint = perms
    ? "y: allow · a: allow all · n: deny"
    : qs
      ? "enter: confirm · n: deny"
      : dlg
        ? "esc: close · tab: navigate"
        : generating
          ? "↑↓ scroll · e: tools · ctrl+c abort"
          : scroll > 0
            ? "ctrl+↓: snap bottom · shift+↑↓: scroll"
            : "ctrl+k: commands · ctrl+s: sessions · shift+tab: agent"

  return (
    <Box height={1}>
      <Text color={theme.overlay} backgroundColor={bg}>
        primary agent
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        │{" "}
      </Text>
      <Text backgroundColor={pill} color={theme.base}>{` ${agent} `}</Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        │{" "}
      </Text>
      <Text color={theme.cyan} backgroundColor={bg}>
        {display}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {" "}
        │{" "}
      </Text>
      <Text color={theme.overlay} backgroundColor={bg}>
        {hint}
      </Text>
    </Box>
  )
}
