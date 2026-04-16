import React from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { Header } from "../components/Header"
import { Spinner } from "../components/Spinner"
import { StatusBar } from "../components/StatusBar"
import { useTheme } from "../theme-context"
import { BottomDock, dockHeight } from "../components/BottomDock"
import type { Dialog } from "../store"
import { primaryKey, resolveAction } from "../keybindings"

interface Props {
  rows: number
  columns: number
  active: boolean
  dialog?: Dialog
}

export function HomeScreen({ rows, columns, active, dialog }: Props) {
  const theme = useTheme()
  const syncStatus = useAppStore((s) => s.syncStatus)
  const sessions = useAppStore((s) => s.sessions)
  const providers = useAppStore((s) => s.providers)
  const vcs = useAppStore((s) => s.vcs)
  const navigate = useAppStore((s) => s.navigate)
  const sendPrompt = useAppStore((s) => s.sendPrompt)
  const retryBootstrap = useAppStore((s) => s.retryBootstrap)
  const bindings = useAppStore((s) => s.keybindings)

  const dir = useAppStore((s) => s.directory)
  const composerLines = useAppStore((s) => s.composerLines)
  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"
  const dockRows = dockHeight({ rows, dialog, inputLines: composerLines })
  const mainRows = Math.max(1, rows - 2 - dockRows)

  const handleSubmit = async (text: string) => {
    const store = useAppStore.getState()
    if (!store.client) return
    const res = await store.client.session.create().catch(() => undefined)
    if (!res || res.error) {
      store.addToast({
        title: "Failed to create session",
        message: "Could not start a new session. Check the server connection.",
        variant: "error",
        duration: 5000,
      })
      // Restore the prompt so the user can try again
      store.setComposerAppend(text)
      return
    }
    const sid = res.data.id
    store.trackFrecency(`session:${sid}`)
    useAppStore.setState({ currentSessionID: sid })
    navigate({ type: "session", sessionID: sid })
    await sendPrompt(sid, text)
  }

  const isLoading = syncStatus === "loading"
  const isPartial = syncStatus === "partial"
  const recent = sessions.slice(-4).reverse()

  useInput(
    (input, key) => {
      const action = resolveAction(bindings, input, key, ["session"])
      if (isPartial && action === "retry") retryBootstrap()
    },
    { isActive: active },
  )

  const palette = primaryKey(bindings, "commandPalette", ["global"]) || "ctrl+k"
  const retry = primaryKey(bindings, "retry", ["session"]) || "r"

  return (
    <Box height={rows} width={columns} flexDirection="column">
      <Header projectName={project} gitBranch={branch} sessionCount={sessions.length} status="idle" width={columns} />

      <Box height={mainRows} flexDirection="column" justifyContent="center" alignItems="center">
        {isLoading && <Spinner label=" connecting to server..." />}

        {isPartial && (
          <>
            <Text color={theme.red}>connection failed</Text>
            <Text color={theme.subtext}>Check that the server is running and restart bettercode.</Text>
            <Text color={theme.overlay}>{`${retry}: retry`}</Text>
          </>
        )}

        {!isLoading && !isPartial && (
          <Box flexDirection="column">
            <Text color={theme.text} bold>
              bettercode
            </Text>

            {providers.length === 0 ? (
              <Box marginTop={1} flexDirection="column">
                <Text color={theme.yellow}>no providers connected</Text>
                <Text color={theme.subtext}>type /provider to configure an API key and get started</Text>
              </Box>
            ) : (
              <Text color={theme.overlay} wrap="wrap">
                {providers.length} provider{providers.length !== 1 ? "s" : ""} · {project}
              </Text>
            )}

            {recent.length > 0 && (
              <Box marginTop={2} flexDirection="column">
                <Text color={theme.overlay}>recent sessions</Text>
                {recent.map((s) => (
                  <Text key={s.id} color={theme.subtext}>
                    {"  · "}{s.title ?? s.id.slice(0, 8)}
                  </Text>
                ))}
              </Box>
            )}

            <Box marginTop={2}>
              <Text color={theme.overlay}>
                {providers.length === 0 ? `${palette}: commands · /provider: add a provider` : "start with a prompt or resume a recent session"}
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      <BottomDock
        dialog={dialog}
        rows={dockRows}
        columns={columns}
        active={active && !isLoading && !isPartial}
        generating={false}
        onSubmit={handleSubmit}
        onAbort={() => {}}
      />

      <StatusBar width={columns} />
    </Box>
  )
}
