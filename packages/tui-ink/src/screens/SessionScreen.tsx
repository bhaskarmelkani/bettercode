import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useShallow } from "zustand/shallow"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { Header } from "../components/Header"
import { MessageList } from "../components/MessageList"
import { Composer } from "../components/Composer"
import { PermissionPrompt } from "../components/PermissionPrompt"
import { QuestionPrompt } from "../components/QuestionPrompt"
import { StatusBar } from "../components/StatusBar"
import { Sidebar } from "../components/Sidebar"
import { ToastOverlay } from "../components/ToastOverlay"

interface Props {
  sessionID: string
  rows: number
  columns: number
  active: boolean
}

export function SessionScreen({ sessionID, rows, columns, active }: Props) {
  const theme = useTheme()
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

  const SIDEBAR_WIDTH = 32

  // Layout: 1 header + 1 separator + 2 composer (input+hint) + 1 statusbar = 5 rows reserved
  // Plus permission/question prompts if visible
  const promptHeight = 2 // composer rows: input + hint
  const permHeight = permissions.length > 0 ? 6 : 0
  const qHeight = questions.length > 0 && permissions.length === 0 ? 8 : 0
  const listHeight = Math.max(1, rows - 1 - 1 - 1 - promptHeight - permHeight - qHeight)
  const mainWidth = sidebarOpen ? columns - SIDEBAR_WIDTH : columns

  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"

  useInput(
    (_input, key) => {
      if (key.ctrl && _input === "b") {
        setSidebarOpen((v) => !v)
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
        status={isError ? "error" : generating ? "generating" : "idle"}
      />

      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width={mainWidth}>
          <MessageList
            sessionID={sessionID}
            height={listHeight}
            width={mainWidth - 4}
            active={active && permissions.length === 0 && questions.length === 0}
            generating={generating}
          />

          {permissions.length > 0 && <PermissionPrompt request={permissions[0]!} />}

          {permissions.length === 0 && questions.length > 0 && <QuestionPrompt request={questions[0]!} />}

          <ToastOverlay />

          {/* Separator between content and input — mirrors Claude Code's divider */}
          <Box flexShrink={0}>
            <Text color={theme.surface1}>{"─".repeat(mainWidth)}</Text>
          </Box>

          <Composer
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            active={active && permissions.length === 0 && questions.length === 0}
            generating={generating}
          />
        </Box>

        {sidebarOpen && <Sidebar sessionID={sessionID} width={SIDEBAR_WIDTH} height={rows - 2} active={false} />}
      </Box>

      <StatusBar />
    </Box>
  )
}
