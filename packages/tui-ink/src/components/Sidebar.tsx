import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"

interface Props {
  sessionID: string
  width: number
  height: number
  active: boolean
}

type Tab = "diff" | "todos" | "lsp" | "mcp" | "workspace"
const TABS: Tab[] = ["diff", "todos", "lsp", "mcp", "workspace"]

type TodoItem = { id: string; content: string; status: string; priority?: string }

export function Sidebar({ sessionID, width, height, active }: Props) {
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>("diff")
  const [todos, setTodos] = useState<TodoItem[]>([])
  const client = useAppStore((s) => s.client)
  const sessionDiff = useAppStore((s) => s.sessionDiff[sessionID] ?? [])
  const lsp = useAppStore((s) => s.lsp)
  const mcp = useAppStore((s) => s.mcp)
  const vcs = useAppStore((s) => s.vcs)

  // Fetch todos when on todos tab
  useEffect(() => {
    if (tab !== "todos" || !client) return
    client.session
      .todo({ sessionID })
      .then((r) => setTodos((r.data as TodoItem[]) ?? []))
      .catch(() => {})
  }, [tab, sessionID, client])

  useInput(
    (input, key) => {
      if (key.tab || key.rightArrow) {
        setTab((t) => TABS[(TABS.indexOf(t) + 1) % TABS.length]!)
        return
      }
      if (key.leftArrow) {
        setTab((t) => TABS[(TABS.indexOf(t) - 1 + TABS.length) % TABS.length]!)
        return
      }
    },
    { isActive: active },
  )

  const contentHeight = height - 2

  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="single" borderColor={theme.surface1}>
      {/* Tab bar */}
      <Box
        flexDirection="row"
        borderStyle="single"
        borderBottom
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor={theme.surface0}
      >
        {TABS.map((t) => (
          <Box key={t} paddingX={1}>
            <Text color={t === tab ? theme.cyan : theme.overlay} bold={t === tab}>
              {t}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Content */}
      <Box flexDirection="column" height={contentHeight} paddingX={1} overflow="hidden">
        {tab === "diff" && (
          <>
            {sessionDiff.length === 0 ? (
              <Text color={theme.overlay} dimColor>
                No file changes
              </Text>
            ) : (
              sessionDiff.map((d) => (
                <Box key={d.file} flexDirection="row" gap={1}>
                  <Text color={d.status === "added" ? theme.green : d.status === "deleted" ? theme.red : theme.yellow}>
                    {d.status === "added" ? "+" : d.status === "deleted" ? "-" : "~"}
                  </Text>
                  <Text color={theme.subtext} wrap="truncate-end">
                    {d.file}
                  </Text>
                </Box>
              ))
            )}
          </>
        )}

        {tab === "todos" && (
          <>
            {todos.length === 0 ? (
              <Text color={theme.overlay} dimColor>
                No todos
              </Text>
            ) : (
              todos.map((t) => (
                <Box key={t.id} flexDirection="row" gap={1}>
                  <Text
                    color={
                      t.status === "completed" ? theme.green : t.status === "in_progress" ? theme.yellow : theme.overlay
                    }
                  >
                    {t.status === "completed" ? "✓" : t.status === "in_progress" ? "◎" : "○"}
                  </Text>
                  <Text color={theme.subtext} wrap="truncate-end">
                    {t.content}
                  </Text>
                </Box>
              ))
            )}
          </>
        )}

        {tab === "lsp" && (
          <>
            {lsp.length === 0 ? (
              <Text color={theme.overlay} dimColor>
                No LSP servers
              </Text>
            ) : (
              lsp.map((l) => (
                <Box key={l.name} flexDirection="row" gap={1}>
                  <Text color={(l as any).running ? theme.green : theme.red}>{(l as any).running ? "●" : "○"}</Text>
                  <Text color={theme.subtext}>{l.name}</Text>
                </Box>
              ))
            )}
          </>
        )}

        {tab === "mcp" && (
          <>
            {Object.keys(mcp).length === 0 ? (
              <Text color={theme.overlay} dimColor>
                No MCP servers
              </Text>
            ) : (
              Object.entries(mcp).map(([name, s]) => (
                <Box key={name} flexDirection="row" gap={1}>
                  <Text
                    color={s.status === "connected" ? theme.green : s.status === "failed" ? theme.red : theme.overlay}
                  >
                    {s.status === "connected" ? "●" : "○"}
                  </Text>
                  <Text color={theme.subtext} wrap="truncate-end">
                    {name}
                  </Text>
                </Box>
              ))
            )}
          </>
        )}

        {tab === "workspace" && (
          <>
            <Text color={theme.subtext}>
              Branch: <Text color={theme.cyan}>{vcs?.branch ?? "—"}</Text>
            </Text>
          </>
        )}
      </Box>

      <Box>
        <Text color={theme.surface2} dimColor>
          tab/←→ switch
        </Text>
      </Box>
    </Box>
  )
}
