import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import type { ToolPart as ToolPartType } from "@opencode-ai/sdk/v2"
import { useShallow } from "zustand/shallow"
import { useAppStore, SIDEBAR_WIDTHS } from "../store"
import { Header } from "../components/Header"
import { MessageList } from "../components/MessageList"
import { SearchBar } from "../components/SearchBar"
import { StatusBar } from "../components/StatusBar"
import { Sidebar } from "../components/Sidebar"
import { ToastOverlay } from "../components/ToastOverlay"
import { BottomDock, dockHeight } from "../components/BottomDock"
import { useTheme } from "../theme-context"
import { ErrorBoundary } from "../components/ErrorBoundary"
import type { Dialog } from "../store"
import { resolveAction } from "../keybindings"

interface Props {
  sessionID: string
  rows: number
  columns: number
  active: boolean
  dialog?: Dialog
}

const HINTS = ["Thinking…", "Working…", "Processing…", "Reasoning…"]

// Minimum terminal width to show a non-collapsed sidebar.
const SIDEBAR_MIN = 80
// Space consumed by transcript paddingX={2} on each side.
const TRANSCRIPT_HPAD = 4 // 2 (left) + 2 (right)

export function SessionScreen({ sessionID, rows, columns, active, dialog }: Props) {
  const theme = useTheme()

  // Consolidate all store subscriptions into one shallow selector (M3.4).
  const {
    syncStatus,
    sessions,
    vcs,
    sendPrompt,
    abortSession,
    enqueuePrompt,
    dequeuePrompt,
    clearQueue,
    dir,
    status,
    composerStatus,
    loadMessages,
    toggleDiffCollapse,
    retryBootstrap,
    openSearch,
    searchMode,
    searchMatchCount,
    scrolled,
    bindings,
    sidebarMode,
    cycleSidebarMode,
    setSidebarMode,
  } = useAppStore(
    useShallow((s) => ({
      syncStatus: s.syncStatus,
      sessions: s.sessions,
      vcs: s.vcs,
      sendPrompt: s.sendPrompt,
      abortSession: s.abortSession,
      enqueuePrompt: s.enqueuePrompt,
      dequeuePrompt: s.dequeuePrompt,
      clearQueue: s.clearQueue,
      dir: s.directory,
      status: s.sessionStatus[sessionID],
      composerStatus: s.composerStatus,
      loadMessages: s.loadMessages,
      toggleDiffCollapse: s.toggleDiffCollapse,
      retryBootstrap: s.retryBootstrap,
      openSearch: s.openSearch,
      searchMode: s.searchMode,
      searchMatchCount: s.searchMatchCount,
      scrolled: (s.scrollPos[sessionID] ?? 0) > 0,
      bindings: s.keybindings,
      sidebarMode: s.sidebarMode,
      cycleSidebarMode: s.cycleSidebarMode,
      setSidebarMode: s.setSidebarMode,
    })),
  )

  const queue = useAppStore(useShallow((s) => s.promptQueue[sessionID] ?? []))
  const composerLines = useAppStore((s) => s.composerLines)

  // Permissions and questions for this session and child sessions.
  const permissions = useAppStore(
    useShallow((s) => {
      const perms = s.permissions[sessionID] ?? []
      const childPerms = s.sessions
        .filter((sess) => sess.parentID === sessionID)
        .flatMap((child) => s.permissions[child.id] ?? [])
      return [...perms, ...childPerms]
    }),
  )

  const questions = useAppStore(
    useShallow((s) => {
      const qs = s.questions[sessionID] ?? []
      const childQs = s.sessions
        .filter((sess) => sess.parentID === sessionID)
        .flatMap((child) => s.questions[child.id] ?? [])
      return [...qs, ...childQs]
    }),
  )

  const generating = status?.type === "busy" || composerStatus === "generating"
  const hint = useAppStore((s) => {
    if (!generating) return undefined
    const last = (s.messages[sessionID] ?? []).findLast((m) => m.role === "assistant")
    if (!last) return undefined
    const tools = (s.parts[last.id] ?? []).filter((p): p is ToolPartType => p.type === "tool")
    const running = tools.find((p) => p.state.status === "running")
    if (!running) return undefined
    return "title" in running.state && running.state.title ? running.state.title : running.tool
  })
  const [verbIdx, setVerbIdx] = useState(0)

  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setVerbIdx((i) => (i + 1) % HINTS.length), 2000)
    return () => clearInterval(t)
  }, [generating])

  const spinnerHint = hint ?? HINTS[verbIdx]!
  const isError = composerStatus === "error"

  // Derived sidebar state.
  const sidebarWidth = SIDEBAR_WIDTHS[sidebarMode]
  const sidebarOpen = sidebarMode !== "collapsed"

  // Viewport math (M1.1).
  // Header occupies 1 row; StatusBar occupies 1 row.
  const mainHeight = Math.max(1, rows - 2)

  const dockRows = dockHeight({
    rows,
    dialog,
    permissions,
    questions,
    inputLines: composerLines,
    queueLength: queue.length,
  })
  const searchRows = searchMode ? 1 : 0
  const listHeight = Math.max(1, mainHeight - dockRows - searchRows)
  const mainWidth = Math.max(1, columns - (sidebarOpen ? sidebarWidth : 0))

  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"
  const inputActive = active && !dialog && !sidebarOpen && !searchMode && permissions.length === 0

  // Lazy-load messages when this session becomes active.
  useEffect(() => {
    loadMessages(sessionID)
  }, [sessionID])

  useEffect(() => {
    useAppStore.getState().closeSearch()
    if (useAppStore.getState().focusMode) useAppStore.getState().toggleFocusMode()
  }, [sessionID])

  // Force collapsed on narrow terminals.
  useEffect(() => {
    if (columns < SIDEBAR_MIN && sidebarMode !== "collapsed") setSidebarMode("collapsed")
  }, [columns, sidebarMode])

  useInput(
    (_input, key) => {
      const action = resolveAction(bindings, _input, key, ["session"])

      if (action === "toggleSidebar") {
        if (scrolled) return
        if (columns >= SIDEBAR_MIN) cycleSidebarMode(1)
        return
      }
      if (action === "sidebarModeNext") {
        if (columns >= SIDEBAR_MIN) cycleSidebarMode(1)
        return
      }
      if (action === "sidebarModePrev") {
        if (columns >= SIDEBAR_MIN) cycleSidebarMode(-1)
        return
      }
      if (action === "toggleFocus") {
        useAppStore.getState().toggleFocusMode()
        return
      }
      if (action === "openSearch") {
        if (scrolled) return
        openSearch()
        return
      }
      if (action === "retry") {
        if (syncStatus !== "partial") return
        retryBootstrap()
        return
      }
      if (action === "toggleThinking") {
        useAppStore.getState().cycleThinkingLevel()
        return
      }
      if (action === "toggleDiffs") {
        const state = useAppStore.getState()
        const withDiffs = (state.messages[sessionID] ?? []).filter(
          (msg) => msg.role === "assistant" && (state.messageDiff[msg.id]?.length ?? 0) > 0,
        )
        if (withDiffs.length === 0) return
        const allCollapsed = withDiffs.every((msg) => state.collapsedDiffs[msg.id] !== false)
        if (allCollapsed) {
          const last = withDiffs[withDiffs.length - 1]
          if (last) toggleDiffCollapse(last.id)
        } else {
          for (const msg of withDiffs) {
            if (state.collapsedDiffs[msg.id] === false) toggleDiffCollapse(msg.id)
          }
        }
      }
    },
    { isActive: active },
  )

  const handleSubmit = async (text: string, files?: import("@opencode-ai/sdk/v2").FilePartInput[]) => {
    if (generating) {
      enqueuePrompt(sessionID, text, files)
    } else {
      await sendPrompt(sessionID, text, files)
    }
  }

  const handleSteer = async (text: string, files?: import("@opencode-ai/sdk/v2").FilePartInput[]) => {
    await sendPrompt(sessionID, text, files)
  }

  const handleAbort = () => {
    abortSession(sessionID)
  }

  if (syncStatus === "loading") {
    return (
      <Box height={rows} width={columns} justifyContent="center" alignItems="center" flexDirection="column">
        <Text color={theme.cyan}>Connecting...</Text>
      </Box>
    )
  }

  if (syncStatus === "partial") {
    return (
      <Box height={rows} width={columns} justifyContent="center" alignItems="center" flexDirection="column">
        <Text color={theme.red}>Server connection failed.</Text>
        <Text color={theme.subtext}>Check that the server is running, then restart bettercode.</Text>
        <Text color={theme.overlay}>r: retry</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Header
        projectName={project}
        gitBranch={branch}
        status={isError ? "error" : generating ? "generating" : "idle"}
        width={columns}
        hint={generating ? spinnerHint : undefined}
      />
      <Box flexDirection="row" height={mainHeight}>
        <Box flexDirection="column" width={mainWidth}>
          {searchMode && <SearchBar matchCount={searchMatchCount} active={active && searchMode} />}
          <ErrorBoundary label="transcript">
            <MessageList
              sessionID={sessionID}
              height={listHeight}
              width={Math.max(1, mainWidth - TRANSCRIPT_HPAD)}
              active={inputActive}
              generating={generating}
            />
          </ErrorBoundary>

          <ToastOverlay />

          <ErrorBoundary label="dock">
            <BottomDock
              dialog={dialog}
              rows={dockRows}
              columns={mainWidth}
              active={inputActive}
              generating={generating}
              onSubmit={handleSubmit}
              onAbort={handleAbort}
              onSteer={handleSteer}
              permissions={permissions}
              questions={questions}
              queue={queue}
              onDequeue={(id) => dequeuePrompt(sessionID, id)}
              onClearQueue={() => clearQueue(sessionID)}
            />
          </ErrorBoundary>
        </Box>

        {sidebarOpen && (
          <ErrorBoundary label="sidebar">
            <Sidebar
              sessionID={sessionID}
              width={sidebarWidth}
              height={mainHeight}
              active={active && sidebarOpen}
              mode={sidebarMode}
            />
          </ErrorBoundary>
        )}
      </Box>

      <StatusBar width={columns} sidebarOpen={sidebarOpen} />
    </Box>
  )
}
