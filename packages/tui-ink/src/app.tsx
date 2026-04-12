import React, { useState, useEffect } from "react"
import { Box, Text, useStdout, useInput } from "ink"
import { Header } from "./components/Header"
import { ChatPane } from "./components/ChatPane"
import { ContextPane } from "./components/ContextPane"
import { InputBar } from "./components/InputBar"
import { StatusBar } from "./components/StatusBar"
import { useAppStore } from "./store"
import { useSDK } from "./hooks/useSDK"
import { theme } from "./theme"

interface AppProps {
  onExit?: () => void
}

export function App({ onExit }: AppProps) {
  const { stdout } = useStdout()
  const [columns, setColumns] = useState(stdout?.columns ?? 80)
  const [rows, setRows] = useState(stdout?.rows ?? 24)

  useEffect(() => {
    if (!stdout) return
    const resize = () => {
      setColumns(stdout.columns ?? 80)
      setRows(stdout.rows ?? 24)
    }
    stdout.on("resize", resize)
    return () => {
      stdout.off("resize", resize)
    }
  }, [stdout])

  const status = useAppStore((s) => s.status)
  const chatHistory = useAppStore((s) => s.chatHistory)
  const activeContext = useAppStore((s) => s.activeContext)
  const projectName = useAppStore((s) => s.projectName)
  const gitBranch = useAppStore((s) => s.gitBranch)
  const serverUrl = useAppStore((s) => s.serverUrl)
  const directory = useAppStore((s) => s.directory)
  const serverHeaders = useAppStore((s) => s.serverHeaders)
  const currentSessionID = useAppStore((s) => s.currentSessionID)
  const addMessage = useAppStore((s) => s.addMessage)
  const sendMessage = useAppStore((s) => s.sendMessage)

  useSDK({ url: serverUrl, directory, headers: serverHeaders })

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onExit?.()
      process.exit(0)
    }
    if (key.ctrl && input === "n") {
      useAppStore.getState().clearHistory()
      useAppStore.getState().setStatus("idle")
    }
  })

  // Reserve rows: 1 header + 1 statusbar + 3 inputbar = 5
  const workspaceHeight = rows - 5

  // 1-column divider: chat 70% of (columns - 1), context 30%
  const chatWidth = Math.floor((columns - 1) * 0.7)
  const contextWidth = columns - 1 - chatWidth

  const handleSubmit = async (text: string) => {
    addMessage("user", text)
    let sid = currentSessionID
    if (!sid) {
      const client = useAppStore.getState().sdkClient
      if (!client) return
      const res = await client.session.create().catch(() => undefined)
      if (!res || res.error) return
      sid = res.data.id
      useAppStore.setState({ currentSessionID: sid })
    }
    await sendMessage(sid, text)
  }

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Header projectName={projectName} gitBranch={gitBranch} status={status} />

      <Box flexDirection="row" flexGrow={1} height={workspaceHeight}>
        <ChatPane messages={chatHistory} width={chatWidth} height={workspaceHeight} />
        <Box width={1} height={workspaceHeight} flexDirection="column">
          {Array.from({ length: workspaceHeight }).map((_, i) => (
            <Text key={i} color={theme.surface1}>
              │
            </Text>
          ))}
        </Box>
        <ContextPane files={activeContext} width={contextWidth} height={workspaceHeight} />
      </Box>

      <StatusBar />
      <InputBar onSubmit={handleSubmit} />
    </Box>
  )
}
