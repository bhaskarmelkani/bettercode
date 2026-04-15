import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import type { Theme } from "../theme"

interface Props {
  rows: number
  columns: number
}

function statusColor(theme: Theme, status: string) {
  switch (status) {
    case "connected":
      return theme.green
    case "disabled":
      return theme.overlay
    case "failed":
      return theme.red
    case "needs_auth":
      return theme.yellow
    case "needs_client_registration":
      return theme.yellow
    default:
      return theme.overlay
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "connected":
      return "connected"
    case "disabled":
      return "disabled"
    case "failed":
      return "failed"
    case "needs_auth":
      return "needs auth"
    case "needs_client_registration":
      return "needs registration"
    default:
      return status
  }
}

export function McpDialog({ rows, columns }: Props) {
  const theme = useTheme()
  const mcp = useAppStore((s) => s.mcp)
  const connectMcp = useAppStore((s) => s.connectMcp)
  const disconnectMcp = useAppStore((s) => s.disconnectMcp)
  const popDialog = useAppStore((s) => s.popDialog)

  const [idx, setIdx] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const entries = Object.entries(mcp)
  const total = entries.length
  const connected = entries.filter(([, item]) => item.status === "connected").length
  const auth = entries.filter(([, item]) => item.status === "needs_auth").length
  const maxVisible = Math.max(1, rows - 8)
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const start = Math.max(0, safeIdx - Math.floor(maxVisible / 2))
  const visible = entries.slice(start, start + maxVisible)

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 3000)
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        popDialog()
        return
      }
      if (key.upArrow) {
        setIdx((i) => Math.max(0, i - 1))
        return
      }
      if (key.downArrow) {
        setIdx((i) => Math.min(total - 1, i + 1))
        return
      }

      if (key.return && entries[safeIdx]) {
        const [name, status] = entries[safeIdx]!
        if (busy === name) return
        if (status.status === "connected") {
          setBusy(name)
          disconnectMcp(name).then(() => {
            showFeedback(`${name} disconnected`)
            setBusy(null)
          })
        } else if (status.status === "disabled" || status.status === "failed" || status.status === "needs_auth") {
          setBusy(name)
          connectMcp(name).then(() => {
            showFeedback(`${name} connect requested`)
            setBusy(null)
          })
        }
        return
      }
    },
    { isActive: true },
  )

  return (
    <Box height={rows} width={columns} flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.mauve} bold>
          MCP Servers
        </Text>
        <Text color={theme.overlay}>{` ${connected}/${total} connected`}</Text>
        {auth > 0 ? <Text color={theme.yellow}>{` · ${auth} need auth`}</Text> : null}
      </Box>

      {total === 0 && <Text color={theme.overlay}>No MCP servers configured.</Text>}

      {visible.map(([name, status], i) => {
        const real = start + i
        const selected = real === safeIdx
        const isBusy = busy === name
        return (
          <Box key={name} flexDirection="column">
            <Box>
              <Text color={selected ? theme.cyan : theme.overlay}>{selected ? "▶ " : "  "}</Text>
              <Text color={selected ? theme.text : theme.subtext} bold={selected}>
                {name}
              </Text>
              <Text color={statusColor(theme, status.status)}>{`  ${isBusy ? "…" : statusLabel(status.status)}`}</Text>
            </Box>
            {selected && status.status === "failed" && (
              <Box paddingLeft={4}>
                <Text color={theme.red}>{status.error}</Text>
              </Box>
            )}
            {selected && status.status === "needs_client_registration" && (
              <Box paddingLeft={4}>
                <Text color={theme.yellow}>{status.error}</Text>
              </Box>
            )}
            {selected && status.status === "needs_auth" && (
              <Box paddingLeft={4}>
                <Text color={theme.overlay}>enter to start auth/connect flow</Text>
              </Box>
            )}
            {selected &&
              (status.status === "connected" || status.status === "disabled" || status.status === "failed") && (
                <Box paddingLeft={4}>
                  <Text color={theme.overlay}>
                    {status.status === "connected" ? "enter to disconnect" : "enter to connect"}
                  </Text>
                </Box>
              )}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <Text color={feedback ? theme.yellow : theme.overlay} wrap="truncate">
          {feedback ?? "↑↓ navigate · enter toggle · esc close"}
        </Text>
      </Box>
    </Box>
  )
}
