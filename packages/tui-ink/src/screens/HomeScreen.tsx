import React from "react"
import { Box, Text } from "ink"
import { useAppStore } from "../store"
import { InputBar } from "../components/InputBar"
import { Spinner } from "../components/Spinner"
import { Header } from "../components/Header"
import { StatusBar } from "../components/StatusBar"
import { useTheme } from "../theme-context"

interface Props {
  rows: number
  columns: number
  active: boolean
}

const logo = [
  " ██████╗ ███████╗████████╗████████╗███████╗██████╗ ",
  " ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗",
  " ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝",
  " ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗",
  " ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║",
  " ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝",
]

export function HomeScreen({ rows, columns, active }: Props) {
  const theme = useTheme()
  const syncStatus = useAppStore((s) => s.syncStatus)
  const sessions = useAppStore((s) => s.sessions)
  const providers = useAppStore((s) => s.providers)
  const vcs = useAppStore((s) => s.vcs)
  const navigate = useAppStore((s) => s.navigate)
  const sendPrompt = useAppStore((s) => s.sendPrompt)

  const dir = useAppStore((s) => s.directory)
  const project = dir?.split("/").pop() ?? "bettercode"
  const branch = vcs?.branch ?? "—"

  const handleSubmit = async (text: string) => {
    const client = useAppStore.getState().client
    if (!client) return
    const res = await client.session.create().catch(() => undefined)
    if (!res || res.error) return
    const sid = res.data.id
    useAppStore.getState().trackFrecency(`session:${sid}`)
    useAppStore.setState({ currentSessionID: sid })
    navigate({ type: "session", sessionID: sid })
    await sendPrompt(sid, text)
  }

  const isLoading = syncStatus === "loading"
  const isPartial = syncStatus === "partial"

  return (
    <Box height={rows} width={columns} flexDirection="column">
      {/* ── Header — same as SessionScreen ── */}
      <Header projectName={project} gitBranch={branch} sessionCount={sessions.length} status="idle" />

      {/* ── Content area ── */}
      <Box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
        {isLoading && <Spinner label=" connecting to server..." />}

        {isPartial && (
          <>
            <Text color={theme.red}>Server connection failed.</Text>
            <Text color={theme.subtext}>Check that the bettercode server is running and retry.</Text>
          </>
        )}

        {!isLoading && !isPartial && (
          <>
            {/* logo */}
            <Box flexDirection="column" alignItems="center">
              {logo.map((line, i) => (
                <Text key={i} color={theme.mauve}>
                  {line}
                </Text>
              ))}
            </Box>

            {/* project + branch */}
            <Box marginTop={1} justifyContent="center">
              <Text color={theme.subtext}>{project}</Text>
              {vcs?.branch && <Text color={theme.overlay}> {vcs.branch}</Text>}
              <Text color={theme.overlay}>
                {" "}
                {providers.length} provider{providers.length !== 1 ? "s" : ""}
              </Text>
            </Box>

            {/* recent sessions (max 3) */}
            {sessions.length > 0 && (
              <Box marginTop={1} flexDirection="column" alignItems="center">
                <Text color={theme.overlay}>recent sessions</Text>
                {sessions
                  .slice(-3)
                  .reverse()
                  .map((s) => (
                    <Text key={s.id} color={theme.surface2}>
                      · {s.title ?? s.id.slice(0, 8)}
                    </Text>
                  ))}
              </Box>
            )}

            {sessions.length === 0 && (
              <Box marginTop={1} justifyContent="center">
                <Text color={theme.overlay}>No sessions yet. Type a message to begin.</Text>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* ── Input — same separator+input structure as SessionScreen ── */}
      <InputBar onSubmit={handleSubmit} active={active && !isLoading && !isPartial} columns={columns} />

      {/* ── StatusBar — same as SessionScreen ── */}
      <StatusBar />
    </Box>
  )
}
