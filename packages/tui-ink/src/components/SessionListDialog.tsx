import React, { useState, useCallback } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import * as Frecency from "../frecency"

interface Props {
  rows: number
  columns: number
}

type Mode = "list" | "rename"

function fmtTime(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function SessionListDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const sessions = useAppStore((s) => s.sessions)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const navigate = useAppStore((s) => s.navigate)
  const popDialog = useAppStore((s) => s.popDialog)
  const createSession = useAppStore((s) => s.createSession)
  const renameSession = useAppStore((s) => s.renameSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const forkSession = useAppStore((s) => s.forkSession)
  const shareSession = useAppStore((s) => s.shareSession)
  const summarizeSession = useAppStore((s) => s.summarizeSession)
  const abortSession = useAppStore((s) => s.abortSession)
  const revertSession = useAppStore((s) => s.revertSession)
  const freq = useAppStore((s) => s.frecency)
  const trackFrecency = useAppStore((s) => s.trackFrecency)

  const [idx, setIdx] = useState(0)
  const [mode, setMode] = useState<Mode>("list")
  const [renameText, setRenameText] = useState("")
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Root sessions: frecency-first, fall back to updated time for unvisited ones
  const roots = [...sessions]
    .filter((s) => s.parentID === undefined)
    .sort((a, b) => {
      const fa = freq[`session:${a.id}`]
      const fb = freq[`session:${b.id}`]
      if (fa && fb) return Frecency.current(fb) - Frecency.current(fa)
      if (fa) return -1
      if (fb) return 1
      return b.time.updated - a.time.updated
    })

  // Build flat display list including expanded children
  type Row = { session: (typeof sessions)[0]; depth: number; realIdx: number }
  const rows_: Row[] = []
  for (const root of roots) {
    rows_.push({ session: root, depth: 0, realIdx: rows_.length })
    if (expanded.has(root.id)) {
      const children = sessions.filter((s) => s.parentID === root.id).sort((a, b) => b.time.updated - a.time.updated)
      for (const child of children) {
        rows_.push({ session: child, depth: 1, realIdx: rows_.length })
      }
    }
  }

  const total = rows_.length
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const current = rows_[safeIdx]

  const childCount = useCallback((id: string) => sessions.filter((s) => s.parentID === id).length, [sessions])

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  const maxVisible = Math.max(1, rows - 10)
  const start = Math.max(0, safeIdx - Math.floor(maxVisible / 2))
  const visible = rows_.slice(start, start + maxVisible)

  useInput(
    (input, key) => {
      if (mode === "rename") {
        if (key.escape) {
          setMode("list")
          setRenameText("")
          return
        }
        if (key.return) {
          if (current && renameText.trim()) {
            renameSession(current.session.id, renameText.trim()).catch(() => {})
          }
          setMode("list")
          setRenameText("")
          return
        }
        if (key.backspace || key.delete) {
          setRenameText((v) => v.slice(0, -1))
          return
        }
        if (!key.ctrl && !key.meta && input) {
          setRenameText((v) => v + input)
        }
        return
      }

      // List mode
      if (key.escape || (key.ctrl && input === "s")) {
        popDialog()
        return
      }
      if (key.upArrow) {
        setIdx((i) => Math.max(0, i - 1))
        setPendingDelete(null)
        setShareUrl(null)
        return
      }
      if (key.downArrow) {
        setIdx((i) => Math.min(total - 1, i + 1))
        setPendingDelete(null)
        setShareUrl(null)
        return
      }

      // Enter: select session
      if (key.return && current) {
        trackFrecency(`session:${current.session.id}`)
        useAppStore.setState({ currentSessionID: current.session.id })
        navigate({ type: "session", sessionID: current.session.id })
        popDialog()
        return
      }

      // n: new session
      if (input === "n") {
        createSession().then((s) => {
          if (!s) return showFeedback("Failed to create session")
          trackFrecency(`session:${s.id}`)
          useAppStore.setState({ currentSessionID: s.id })
          navigate({ type: "session", sessionID: s.id })
          popDialog()
        })
        return
      }

      // d: delete (two-press confirm)
      if (input === "d" && current) {
        if (pendingDelete === current.session.id) {
          deleteSession(current.session.id).catch(() => {})
          setPendingDelete(null)
          setIdx((i) => Math.max(0, i - 1))
        } else {
          setPendingDelete(current.session.id)
        }
        return
      }

      // r: rename
      if (input === "r" && current) {
        setRenameText(current.session.title)
        setMode("rename")
        setPendingDelete(null)
        return
      }

      // f: fork
      if (input === "f" && current) {
        forkSession(current.session.id).then((s) => {
          if (!s) return showFeedback("Fork failed")
          showFeedback(`Forked → ${s.id.slice(0, 8)}`)
          useAppStore.setState({ currentSessionID: s.id })
          navigate({ type: "session", sessionID: s.id })
          popDialog()
        })
        return
      }

      // s: share
      if (input === "s" && current) {
        shareSession(current.session.id).then((url) => {
          if (!url) return showFeedback("Share failed")
          setShareUrl(url)
        })
        return
      }

      // z: summarize
      if (input === "z" && current) {
        summarizeSession(current.session.id).catch(() => {})
        showFeedback("Summarizing…")
        return
      }

      // a: abort
      if (input === "a" && current) {
        abortSession(current.session.id).catch(() => {})
        showFeedback("Aborted")
        return
      }

      // v: revert
      if (input === "v" && current) {
        revertSession(current.session.id).catch(() => {})
        showFeedback("Reverted")
        return
      }

      // → or l: expand/collapse children
      if ((key.rightArrow || input === "l") && current && current.depth === 0) {
        setExpanded((prev) => {
          const next = new Set(prev)
          if (next.has(current.session.id)) next.delete(current.session.id)
          else next.add(current.session.id)
          return next
        })
        return
      }

      // Reset pending delete on any other key
      if (pendingDelete) setPendingDelete(null)
    },
    { isActive: true },
  )

  const hint = (() => {
    if (shareUrl) return `Share URL: ${shareUrl}`
    if (feedback) return feedback
    if (mode === "rename") return `Rename: type new name · enter confirm · esc cancel`
    if (pendingDelete) return `Press d again to confirm delete`
    return `enter open · n new · d delete · r rename · f fork · s share · z compact · a abort · v revert · esc close`
  })()

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          Sessions
        </Text>
        <Text color={theme.overlay}> {roots.length} sessions</Text>
      </Box>

      {/* Rename input */}
      {mode === "rename" && (
        <Box marginBottom={1} borderStyle="single" borderColor={theme.cyan} paddingX={1}>
          <Text color={theme.cyan}>{"rename › "}</Text>
          <Text color={theme.text}>
            {renameText}
            <Text backgroundColor={theme.overlay} color={theme.base}>
              {" "}
            </Text>
          </Text>
        </Box>
      )}

      {/* Session list */}
      {total === 0 && <Text color={theme.overlay}>No sessions yet. Press n to create one.</Text>}

      {visible.map((row, i) => {
        const real = start + i
        const selected = real === safeIdx
        const s = row.session
        const pending = pendingDelete === s.id
        const status = sessionStatus[s.id]
        const busy = status?.type === "busy"
        const count = childCount(s.id)
        const isExpanded = expanded.has(s.id)

        return (
          <Box key={s.id}>
            {row.depth > 0 && <Text color={theme.surface2}>{"  └ "}</Text>}
            <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
            <Text color={pending ? theme.red : selected ? theme.text : theme.subtext} bold={selected}>
              {pending ? `[delete?] ${s.title}` : s.title}
            </Text>
            {busy && <Text color={theme.yellow}>{" ●"}</Text>}
            {count > 0 && row.depth === 0 && (
              <Text color={theme.surface2}>{` ${isExpanded ? "▼" : "▶"} ${count}`}</Text>
            )}
            <Text color={theme.overlay}>{`  ${fmtTime(s.time.updated)}`}</Text>
          </Box>
        )
      })}

      {/* Hint bar */}
      <Box marginTop={1}>
        <Text color={shareUrl ? theme.green : feedback ? theme.yellow : theme.overlay} wrap="truncate">
          {hint}
        </Text>
      </Box>
    </Box>
  )
}
