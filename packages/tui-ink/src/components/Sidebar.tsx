import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import type { Todo } from "@opencode-ai/sdk/v2"

interface Props {
  sessionID: string
  width: number
  height: number
  active: boolean
}

type Tab = "diff" | "todos" | "lsp" | "mcp" | "caps"
const TABS: Tab[] = ["diff", "todos", "lsp", "mcp", "caps"]

export function Sidebar({ sessionID, width, height, active }: Props) {
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>("diff")
  const client = useAppStore((s) => s.client)
  const sessionDiff = useAppStore((s) => s.sessionDiff[sessionID] ?? [])
  const todos = useAppStore((s) => s.todos[sessionID] ?? [])
  const lsp = useAppStore((s) => s.lsp)
  const mcp = useAppStore((s) => s.mcp)
  const skills = useAppStore((s) => s.skills)
  const plugins = useAppStore((s) => s.plugins)
  const hooks = useAppStore((s) => s.hooks)

  // Fetch todos when on todos tab
  useEffect(() => {
    if (tab !== "todos" || !client) return
    client.session
      .todo({ sessionID })
      .then((r) => useAppStore.getState().setTodos(sessionID, (r.data as Todo[]) ?? []))
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
              todos.map((t, i) => (
                <Box key={`${t.content}-${i}`} flexDirection="row" gap={1}>
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
                  <Text color={l.status === "connected" ? theme.green : theme.red}>
                    {l.status === "connected" ? "●" : "○"}
                  </Text>
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

        {tab === "caps" && (
          <>
            <Text color={theme.subtext}>
              Skills: <Text color={theme.cyan}>{String(skills.length)}</Text>
            </Text>
            <Text color={theme.subtext}>
              Plugins: <Text color={theme.cyan}>{String(plugins.length)}</Text>
            </Text>
            <Text color={theme.subtext}>
              Hooks: <Text color={theme.cyan}>{String(hooks.length)}</Text>
            </Text>

            <Box marginTop={1} flexDirection="column">
              <Text color={theme.overlay}>plugins</Text>
              {plugins.length === 0 ? (
                <Text color={theme.overlay} dimColor>
                  No active server plugins
                </Text>
              ) : (
                plugins.slice(0, 4).map((item) => (
                  <Box key={item.id} flexDirection="row" gap={1}>
                    <Text
                      color={
                        item.source === "npm" ? theme.green : item.source === "file" ? theme.yellow : theme.overlay
                      }
                    >
                      {item.source === "npm" ? "◉" : item.source === "file" ? "◎" : "○"}
                    </Text>
                    <Text color={theme.subtext} wrap="truncate-end">
                      {item.id}
                    </Text>
                  </Box>
                ))
              )}
            </Box>

            <Box marginTop={1} flexDirection="column">
              <Text color={theme.overlay}>skills</Text>
              {skills.length === 0 ? (
                <Text color={theme.overlay} dimColor>
                  No skills loaded
                </Text>
              ) : (
                skills.slice(0, 4).map((item) => (
                  <Text key={item.name} color={theme.subtext} wrap="truncate-end">
                    {item.name}
                  </Text>
                ))
              )}
            </Box>

            <Box marginTop={1} flexDirection="column">
              <Text color={theme.overlay}>hooks</Text>
              {hooks.length === 0 ? (
                <Text color={theme.overlay} dimColor>
                  No hook summary
                </Text>
              ) : (
                hooks.slice(0, 4).map((item) => (
                  <Text key={item.name} color={theme.subtext} wrap="truncate-end">
                    {item.name}
                  </Text>
                ))
              )}
            </Box>
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
