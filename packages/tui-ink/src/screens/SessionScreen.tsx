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
import type { Dialog } from "../store"

interface Props {
  sessionID: string
  rows: number
  columns: number
  active: boolean
  dialog?: Dialog
}

export function SessionScreen({ sessionID, rows, columns, active, dialog }: Props) {
  const syncStatus = useAppStore((s) => s.syncStatus)
  const sessions = useAppStore((s) => s.sessions)
  const vcs = useAppStore((s) => s.vcs)
  const sendPrompt = useAppStore((s) => s.sendPrompt)
  const abortSession = useAppStore((s) => s.abortSession)
  const dir = useAppStore((s) => s.directory)
  const sessionStatus = useAppStore((s) => s.sessionStatus)
  const composerStatus = useAppStore((s) => s.composerStatus)
  const loadMessages = useAppStore((s) => s.loadMessages)
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
        .filter((sess) => (sess as any).parentID === sessionID)
        .flatMap((child) => s.permissions[child.id] ?? [])
      return [...perms, ...childPerms]
    }),
  )

  const questions = useAppStore(
    useShallow((s) => {
      const qs = s.questions[sessionID] ?? []
      const childQs = s.sessions
        .filter((sess) => (sess as any).parentID === sessionID)
        .flatMap((child) => s.questions[child.id] ?? [])
      return [...qs, ...childQs]
    }),
  )

  const status = sessionStatus[sessionID]
  // Derive generating from session status. composerStatus adds the brief
  // "optimistic" window between sendPrompt() and the first server event.
  const generating = status?.type === "busy" || composerStatus === "generating"
  // Error is only meaningful via composerStatus — session status doesn't carry error visibility.
  const isError = composerStatus === "error"
  const composerLines = useAppStore((s) => s.composerLines)

  const SIDEBAR_WIDTH = 32
  const SIDEBAR_MIN = 120

  const dockRows = dockHeight({ rows, dialog, permissions, questions, inputLines: composerLines })
  const listHeight = Math.max(1, rows - 2 - dockRows)
  const mainWidth = Math.max(1, sidebarOpen ? columns - SIDEBAR_WIDTH : columns)

  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"

  useEffect(() => {
    if (sidebarOpen && columns < SIDEBAR_MIN) setSidebarOpen(false)
  }, [columns, sidebarOpen])

  useInput(
    (_input, key) => {
      if (key.ctrl && _input === "b") {
        if (columns >= SIDEBAR_MIN) setSidebarOpen((v) => !v)
      }
    },
    { isActive: active },
  )

  const handleSubmit = async (text: string) => {
    await sendPrompt(sessionID, text)
  }

  const handleAbort = () => {
    abortSession(sessionID)
  }

  if (syncStatus === "loading") {
    return (
      <Box height={rows} width={columns} justifyContent="center" alignItems="center">
        <Text>Connecting...</Text>
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
      />

      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width={mainWidth}>
          <MessageList
            sessionID={sessionID}
            height={listHeight}
            width={Math.max(1, mainWidth - 4)}
            active={active && !dialog && permissions.length === 0 && questions.length === 0}
            generating={generating}
          />

          <ToastOverlay />

          <BottomDock
            dialog={dialog}
            rows={dockRows}
            columns={mainWidth}
            active={active && !dialog && permissions.length === 0 && questions.length === 0}
            generating={generating}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            permissions={permissions}
            questions={questions}
          />
        </Box>

        {sidebarOpen && <Sidebar sessionID={sessionID} width={SIDEBAR_WIDTH} height={rows - 2} active={false} />}
      </Box>

      <StatusBar />
    </Box>
  )
}
