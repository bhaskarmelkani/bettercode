import React, { useState, useEffect } from "react"
import { Box, useStdout, useInput } from "ink"
import { useAppStore } from "./store"
import { useSDK } from "./hooks/useSDK"
import { useHostCommands } from "./commands/useHostCommands"
import { HomeScreen } from "./screens/HomeScreen"
import { SessionScreen } from "./screens/SessionScreen"
import { PluginScreen } from "./screens/PluginScreen"
import { DialogOverlay } from "./components/DialogOverlay"
import { ThemeProvider } from "./theme-context"

interface AppProps {
  onExit?: () => void
}

export function App({ onExit }: AppProps) {
  const { stdout } = useStdout()
  const [cols, setCols] = useState(stdout?.columns ?? 80)
  const [rows, setRows] = useState(stdout?.rows ?? 24)

  useEffect(() => {
    if (!stdout) return
    const resize = () => {
      setCols(stdout.columns ?? 80)
      setRows(stdout.rows ?? 24)
    }
    stdout.on("resize", resize)
    return () => {
      stdout.off("resize", resize)
    }
  }, [stdout])

  const serverUrl = useAppStore((s) => s.serverUrl)
  const directory = useAppStore((s) => s.directory)
  const serverHeaders = useAppStore((s) => s.serverHeaders)
  const route = useAppStore((s) => s.route)
  const dialogs = useAppStore((s) => s.dialogs)
  const navigate = useAppStore((s) => s.navigate)
  const pushDialog = useAppStore((s) => s.pushDialog)
  const popDialog = useAppStore((s) => s.popDialog)

  useSDK({ url: serverUrl, directory, headers: serverHeaders })

  // Register all host commands into the registry
  useHostCommands()

  const hasDialog = dialogs.length > 0
  const top = dialogs[dialogs.length - 1]

  // Global keys — always active regardless of screen
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onExit?.()
      process.exit(0)
    }
    // Ctrl+K → command palette
    if (key.ctrl && input === "k") {
      if (hasDialog) {
        popDialog()
      } else {
        pushDialog({ type: "command-palette" })
      }
      return
    }
    // Ctrl+N → go home (start fresh session)
    if (key.ctrl && input === "n") {
      navigate({ type: "home" })
      return
    }
    // Ctrl+S → session list dialog
    if (key.ctrl && input === "s") {
      if (hasDialog) {
        popDialog()
      } else {
        pushDialog({ type: "session-list" })
      }
      return
    }
    // Escape → close top dialog
    if (key.escape && hasDialog) {
      popDialog()
    }
  })

  // Render a single stable tree: screen always mounted (deactivated when dialog open),
  // dialog absolutely overlaid. This prevents screen unmount/remount on dialog transitions,
  // which is the primary cause of terminal flickering.
  return (
    <ThemeProvider>
      <Box width={cols} height={rows} flexDirection="column">
        {route.type === "home" && (
          <HomeScreen rows={rows} columns={cols} active={!hasDialog} />
        )}
        {route.type === "plugin" && (
          <PluginScreen name={route.name} params={route.params} rows={rows} columns={cols} active={!hasDialog} />
        )}
        {route.type === "session" && (
          <SessionScreen sessionID={route.sessionID} rows={rows} columns={cols} active={!hasDialog} />
        )}

        {/* Dialog absolutely positioned over the current screen.
            Yoga positions absolute elements at 0,0 of their parent by default,
            so this covers the screen without needing explicit top/left props.
            The screen stays mounted (just inactive) — eliminating dialog-open flicker. */}
        {top && (
          <Box position="absolute" width={cols} height={rows} flexDirection="column">
            <DialogOverlay dialog={top} rows={rows} columns={cols} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}
