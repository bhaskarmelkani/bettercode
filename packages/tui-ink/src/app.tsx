import React, { useState, useEffect } from "react"
import { Box, useStdout, useInput } from "ink"
import { useAppStore } from "./store"
import { useSDK } from "./hooks/useSDK"
import { useMouse } from "./hooks/useMouse"
import { useHostCommands } from "./commands/useHostCommands"
import { HomeScreen } from "./screens/HomeScreen"
import { SessionScreen } from "./screens/SessionScreen"
import { PluginScreen } from "./screens/PluginScreen"
import { DialogOverlay } from "./components/DialogOverlay"
import { ThemeProvider } from "./theme-context"
import { handleGlobalCopy } from "./hooks/useTextSelection"
import { resolveAction } from "./keybindings"

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
  const bindings = useAppStore((s) => s.keybindings)

  useSDK({ url: serverUrl, directory, headers: serverHeaders })
  useMouse()

  // Register all host commands into the registry
  useHostCommands()

  const hasDialog = dialogs.length > 0
  const top = dialogs[dialogs.length - 1]
  const dockTypes = new Set(["command-palette", "session-list", "provider", "model-picker", "agent-picker", "mcp", "theme"])
  const dock = top && dockTypes.has(top.type) ? top : undefined
  const overlay = top && !dock ? top : undefined

  // Global keys — always active regardless of screen
  useInput((input, key) => {
    const action = resolveAction(bindings, input, key, hasDialog ? ["dialog", "global"] : ["global"])

    if (action === "exit") {
      void handleGlobalCopy().then((handled) => {
        if (handled) return
        onExit?.()
        process.exit(0)
      })
      return
    }
    if (action === "commandPalette") {
      if (!hasDialog) {
        pushDialog({ type: "command-palette" })
      }
      return
    }
    if (action === "newSession") {
      navigate({ type: "home" })
      return
    }
    if (action === "sessionList") {
      if (!hasDialog) {
        pushDialog({ type: "session-list" })
      }
      return
    }
    if (action === "close" && overlay) {
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
          <HomeScreen rows={rows} columns={cols} active={!hasDialog} dialog={dock} />
        )}
        {route.type === "plugin" && (
          <PluginScreen name={route.name} params={route.params} rows={rows} columns={cols} active={!hasDialog} />
        )}
        {route.type === "session" && (
          <SessionScreen sessionID={route.sessionID} rows={rows} columns={cols} active={!hasDialog} dialog={dock} />
        )}

        {/* Keep destructive/alert overlays on top; routine pickers now live in the bottom dock. */}
        {overlay && (
          <Box position="absolute" width={cols} height={rows} flexDirection="column">
            <DialogOverlay dialog={overlay} rows={rows} columns={cols} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}
