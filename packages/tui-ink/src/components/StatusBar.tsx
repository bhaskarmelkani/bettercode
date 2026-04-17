import React, { useDeferredValue } from "react"
import { Box, Text } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { TokenWarning } from "./TokenWarning"
import { primaryKey } from "../keybindings"
import { KeyboardShortcutHint, hintText } from "./design-system"

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
  const bindings = useAppStore((s) => s.keybindings)
  const used = useAppStore((s) => s.contextUsage(s.currentSessionID)?.used)
  const max = useAppStore((s) => s.contextUsage(s.currentSessionID)?.max)
  const percent = useAppStore((s) => s.contextUsage(s.currentSessionID)?.percent)
  const edits = useAppStore((s) =>
    (s.messages[sid] ?? []).some((msg) => msg.role === "assistant" && (s.messageDiff[msg.id]?.length ?? 0) > 0),
  )
  const usage = React.useMemo(() => {
    if (used === undefined || max === undefined || percent === undefined) return
    return { used, max, percent }
  }, [max, percent, used])

  const thinkingLevel = useAppStore((s) => s.thinkingLevel)
  // Active child agents count (M6.2.d) — deferred so it never blocks the main render path.
  const activeChildrenRaw = useAppStore((s) =>
    s.sessions.filter(
      (sess) => sess.parentID === sid && s.sessionStatus[sess.id]?.type === "busy",
    ).length,
  )
  const activeChildren = useDeferredValue(activeChildrenRaw)
  const display = cut(model ? model.modelID : "no model", 24)
  const generating = session?.type === "busy" || composerStatus === "generating"
  const tone = agent === "plan" ? theme.yellow : theme.blue
  const mode = primaryKey(bindings, "toggleMode", ["chat"]) || "shift+tab"
  const modeLabel = focusMode ? `${mode} (overview)` : mode
  const focus = primaryKey(bindings, "toggleFocus", ["session"]) || "ctrl+o"
  const next = primaryKey(bindings, "searchNext", ["search"]) || "enter"
  const prev = primaryKey(bindings, "searchPrev", ["search"]) || "ctrl+p"
  const close = primaryKey(bindings, "searchClose", ["search"]) || "esc"
  const sidebar = primaryKey(bindings, "toggleSidebar", ["session"]) || "ctrl+b"
  const abort = primaryKey(bindings, "exit", ["global"]) || "ctrl+c"
  const diffs = primaryKey(bindings, "toggleDiffs", ["session"]) || "ctrl+g"
  const snap = primaryKey(bindings, "snapBottom", ["scroll"]) || "ctrl+down"
  const halfDown = primaryKey(bindings, "scrollHalfDown", ["scroll"]) || "ctrl+d"
  const palette = primaryKey(bindings, "commandPalette", ["global"]) || "ctrl+k"
  const thinking = primaryKey(bindings, "toggleThinking", ["session"]) || "ctrl+t"
  const items = focusMode
    ? [{ keys: focus, label: "exit overview" }]
    : searchMode
      ? [
          { keys: next, label: "next" },
          { keys: prev, label: "prev" },
          { keys: close, label: "close" },
        ]
      : perms
        ? [
            { keys: "y", label: "allow" },
            { keys: "a", label: "allow all" },
            { keys: "n", label: "deny" },
          ]
        : qs
          ? [
              { keys: "↑↓", label: "navigate" },
              { keys: "enter", label: "select" },
              { keys: "esc", label: "reject" },
            ]
          : dlg
            ? [
                { keys: "esc", label: "close" },
                { keys: "tab", label: "navigate" },
              ]
            : sidebarOpen
              ? [
                  { keys: "tab/←→", label: "sidebar" },
                  { keys: sidebar, label: "close" },
                ]
              : generating
                ? [{ keys: "↑↓ scroll" }, { keys: abort, label: "abort" }]
                : edits
                  ? [
                      { keys: diffs, label: "expand/collapse edits" },
                      { keys: sidebar, label: "capabilities" },
                    ]
                  : scroll > 0
                    ? [{ keys: halfDown, label: "scroll" }, { keys: snap, label: "snap bottom" }]
                    : [
                        { keys: palette, label: "commands" },
                        { keys: "/", label: "slash" },
                        { keys: sidebar, label: "capabilities" },
                        { keys: thinking, label: "thinking" },
                      ]
  const raw = items.map((item) => hintText(item.keys, item.label)).join(" · ")

  const thinkingLabel = thinkingLevel !== "off" ? thinkingLevel : null
  const sidebarLabel = sidebarOpen ? " sidebar" : null
  // fixed = " "(1) + agent + " (" + mode + ")" + " · "(3) + display + " · "(3) + [level + " · "(3)] + [sidebar + " · "(3)]
  const fixed = 1 + agent.length + 2 + modeLabel.length + 1 + 3 + display.length + 3 +
    (thinkingLabel ? thinkingLabel.length + 3 : 0) +
    (sidebarLabel ? sidebarLabel.length + 3 : 0)
  const hint = cut(raw, Math.max(0, width - fixed))
  const fill = Math.max(0, width - fixed - hint.length)

  return (
    <Box flexDirection="column">
      {usage ? <TokenWarning width={width} usage={usage} /> : null}
      <Box height={1} flexDirection="row">
        <Text color={theme.overlay}> </Text>
        <Text color={tone} bold>
          {agent}
        </Text>
        <Text color={theme.overlay}>{` (${modeLabel})`}</Text>
        <Text color={theme.overlay}>{" · "}</Text>
        <Text color={theme.text}>{display}</Text>
        <Text color={theme.overlay}>{" · "}</Text>
        {thinkingLabel && (
          <>
            <Text color={theme.yellow} bold>{thinkingLabel}</Text>
            <Text color={theme.overlay}>{" · "}</Text>
          </>
        )}
        {sidebarLabel && (
          <>
            <Text color={theme.cyan}>{sidebarLabel}</Text>
            <Text color={theme.overlay}>{" · "}</Text>
          </>
        )}
        {activeChildren > 0 && (
          <>
            <Text color={theme.yellow}>{`${activeChildren} agent${activeChildren > 1 ? "s" : ""}`}</Text>
            <Text color={theme.overlay}>{" · "}</Text>
          </>
        )}
        {hint === raw ? (
          items.map((item, i) => (
            <React.Fragment key={`${item.keys}-${item.label ?? i}`}>
              {i > 0 ? <Text color={theme.overlay}>{" · "}</Text> : null}
              <KeyboardShortcutHint keys={item.keys} label={item.label} />
            </React.Fragment>
          ))
        ) : (
          <Text color={theme.overlay}>{hint}</Text>
        )}
        {fill > 0 ? <Text>{" ".repeat(fill)}</Text> : null}
        {autoAccept && <Text color={theme.yellow}>{" auto-accept "}</Text>}
      </Box>
    </Box>
  )
}
