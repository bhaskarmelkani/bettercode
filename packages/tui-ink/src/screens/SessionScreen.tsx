import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useShallow } from "zustand/shallow"
import { useAppStore } from "../store"
import { Header } from "../components/Header"
import { MessageList } from "../components/MessageList"
import { StatusBar } from "../components/StatusBar"
import { Sidebar } from "../components/Sidebar"
import { ToastOverlay } from "../components/ToastOverlay"
import { BottomDock, dockHeight } from "../components/BottomDock"
import { useTheme } from "../theme-context"
import { ErrorBoundary } from "../components/ErrorBoundary"
import type { Dialog } from "../store"

interface Props {
  sessionID: string
  rows: number
  columns: number
  active: boolean
  dialog?: Dialog
}

export function SessionScreen({ sessionID, rows, columns, active, dialog }: Props) {
  const theme = useTheme()
  const syncStatus = useAppStore((s) => s.syncStatus)
  const sessions = useAppStore((s) => s.sessions)
  const vcs = useAppStore((s) => s.vcs)
  const sendPrompt = useAppStore((s) => s.sendPrompt)
  const abortSession = useAppStore((s) => s.abortSession)
  const enqueuePrompt = useAppStore((s) => s.enqueuePrompt)
  const dequeuePrompt = useAppStore((s) => s.dequeuePrompt)
  const clearQueue = useAppStore((s) => s.clearQueue)
  const queue = useAppStore(useShallow((s) => s.promptQueue[sessionID] ?? []))
  const dir = useAppStore((s) => s.directory)
  const status = useAppStore((s) => s.sessionStatus[sessionID])
  const composerStatus = useAppStore((s) => s.composerStatus)
  const loadMessages = useAppStore((s) => s.loadMessages)
  const toggleDiffCollapse = useAppStore((s) => s.toggleDiffCollapse)
  const retryBootstrap = useAppStore((s) => s.retryBootstrap)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Lazy-load messages when this session becomes active
  useEffect(() => {
    loadMessages(sessionID)
  }, [sessionID])

  // Permissions and questions for this session (and child sessions).
  // useShallow prevents "Maximum update depth exceeded": without it, the spread
  // operator creates a new array on every store update, causing an infinite
  // re-render loop via useSyncExternalStore.
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

  // Derive generating from session status. composerStatus adds the brief
  // "optimistic" window between sendPrompt() and the first server event.
  const generating = status?.type === "busy" || composerStatus === "generating"
  // Error is only meaningful via composerStatus — session status doesn't carry error visibility.
  const isError = composerStatus === "error"
  const composerLines = useAppStore((s) => s.composerLines)

  const SIDEBAR_WIDTH = 32
  const SIDEBAR_MIN = 120

  const dockRows = dockHeight({ rows, dialog, permissions, questions, inputLines: composerLines, queueLength: queue.length })
  const listHeight = Math.max(1, rows - 2 - dockRows)
  const mainWidth = Math.max(1, sidebarOpen ? columns - SIDEBAR_WIDTH : columns)

  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"
  const inputActive = active && !dialog && !sidebarOpen && permissions.length === 0 && questions.length === 0

  useEffect(() => {
    if (sidebarOpen && columns < SIDEBAR_MIN) setSidebarOpen(false)
  }, [columns, sidebarOpen])

  useInput(
    (_input, key) => {
      if (key.ctrl && _input === "b") {
        if (columns >= SIDEBAR_MIN) setSidebarOpen((v) => !v)
      }
      if (syncStatus === "partial" && _input === "r") {
        retryBootstrap()
        return
      }
      if (key.ctrl && _input === "g") {
        // Cycle through all assistant messages that have diffs, toggling one at a time.
        // If all are collapsed, expand the most recent; otherwise collapse all.
        const state = useAppStore.getState()
        const withDiffs = (state.messages[sessionID] ?? []).filter(
          (msg) => msg.role === "assistant" && (state.messageDiff[msg.id]?.length ?? 0) > 0,
        )
        if (withDiffs.length === 0) return
        const allCollapsed = withDiffs.every((msg) => state.collapsedDiffs[msg.id] !== false)
        if (allCollapsed) {
          // Expand only the most recent
          const last = withDiffs[withDiffs.length - 1]
          if (last) toggleDiffCollapse(last.id)
        } else {
          // Collapse all that are open
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
        sessionCount={sessions.length}
        status={isError ? "error" : generating ? "generating" : "idle"}
        width={columns}
      />
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width={mainWidth}>
          <ErrorBoundary label="transcript">
            <MessageList
              sessionID={sessionID}
              height={listHeight}
              width={Math.max(1, mainWidth - 4)}
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
          <Sidebar sessionID={sessionID} width={SIDEBAR_WIDTH} height={rows - 3} active={active && sidebarOpen} />
        )}
      </Box>

      <StatusBar width={columns} sidebarOpen={sidebarOpen} />
    </Box>
  )
}
