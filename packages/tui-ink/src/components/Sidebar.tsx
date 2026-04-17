import React, { useState, useEffect } from "react"
import { Box, Text, useInput } from "ink"
import { useAppStore } from "../store"
import { useTheme } from "../theme-context"
import { progressBar } from "./TokenWarning"
import type { Todo } from "@opencode-ai/sdk/v2"
import type { SidebarMode } from "../store"

interface Props {
  sessionID: string
  width: number
  height: number
  active: boolean
  mode: SidebarMode
}

type Tab = "diff" | "todos" | "lsp" | "mcp" | "caps" | "context" | "insights"
const TABS: Tab[] = ["diff", "todos", "lsp", "mcp", "caps", "context", "insights"]

// Session overview band — shows at top of sidebar in all non-collapsed modes.
function OverviewBand({ sessionID, width }: { sessionID: string; width: number }) {
  const theme = useTheme()
  const usage = useAppStore((s) => s.contextUsage(sessionID))
  const vcs = useAppStore((s) => s.vcs)
  const currentModel = useAppStore((s) => s.currentModel)
  const currentAgent = useAppStore((s) => s.currentAgent)

  const percent = usage?.percent ?? 0
  const remain = Math.max(0, 100 - percent)
  const barColor = percent >= 85 ? theme.red : percent >= 60 ? theme.yellow : theme.green

  const model = currentModel ? `${currentModel.providerID}/${currentModel.modelID}` : "—"
  const agent = currentAgent ?? "build"
  const branch = vcs?.branch ?? "—"

  return (
    <Box flexDirection="column" borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor={theme.surface0} paddingX={1}>
      <Text color={theme.subtext} wrap="truncate-end">
        {`${branch} · ${agent}`}
      </Text>
      {width >= 20 && (
        <Text color={theme.overlay} wrap="truncate-end">
          {`${model}`}
        </Text>
      )}
      {usage && (
        <Box flexDirection="row" gap={1}>
          <Text color={barColor}>{`ctx`}</Text>
          <Text color={barColor}>{progressBar(usage.percent / 100, Math.min(12, width - 8))}</Text>
          <Text color={barColor}>{`${remain}%`}</Text>
        </Box>
      )}
    </Box>
  )
}

// Collapsed mode — icon strip only (4 columns wide).
function CollapsedStrip({ generating }: { generating: boolean }) {
  const theme = useTheme()
  const usage = useAppStore((s) => {
    // Can't select sessionID here without prop drilling — just check for any usage.
    return undefined as ReturnType<typeof s.contextUsage>
  })

  const contextColor = (usage?.percent ?? 0) >= 85 ? theme.red : (usage?.percent ?? 0) >= 60 ? theme.yellow : theme.green

  return (
    <Box flexDirection="column" width={4} alignItems="center" paddingTop={1} gap={1}>
      {generating ? (
        <Text color={theme.cyan}>⟳</Text>
      ) : (
        <Text color={theme.overlay}>│</Text>
      )}
      <Text color={contextColor}>▌</Text>
    </Box>
  )
}

export function Sidebar({ sessionID, width, height, active, mode }: Props) {
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
  const status = useAppStore((s) => s.sessionStatus[sessionID])
  const generating = status?.type === "busy"

  // Context tab state (M4.5)
  const [contextData, setContextData] = useState<string | null>(null)
  // Insights tab state (M4.6, M4.7)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const isCompact = mode === "compact"
  const isExpanded = mode === "expanded"

  // Fetch todos when on todos tab
  useEffect(() => {
    if (tab !== "todos" || !client) return
    client.session
      .todo({ sessionID })
      .then((r) => useAppStore.getState().setTodos(sessionID, (r.data as Todo[]) ?? []))
      .catch(() => {})
  }, [tab, sessionID, client])

  // Context tab: compute local context breakdown (M4.5)
  useEffect(() => {
    if (tab !== "context") return
    const state = useAppStore.getState()
    const usage = state.contextUsage(sessionID)
    const msgs = state.messages[sessionID] ?? []
    const recent = msgs
      .filter((m) => m.role === "user")
      .slice(-5)
      .map((m) => `• ${String(m.id).slice(0, 8)}`)
      .join("\n")

    const lines = [
      `Used: ${usage ? `${usage.used} / ${usage.max} tokens (${usage.percent}%)` : "Unknown"}`,
      `Messages: ${msgs.length}`,
      `Recent user turns:`,
      recent || "  (none)",
    ]
    setContextData(lines.join("\n"))
  }, [tab, sessionID])

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

  // Collapsed sidebar just shows the icon strip.
  if (mode === "collapsed") {
    return <CollapsedStrip generating={generating} />
  }

  const overviewHeight = 4
  const tabBarHeight = 1
  const footerHeight = 1
  const contentHeight = height - overviewHeight - tabBarHeight - footerHeight - 2 // borders

  const tabLabels = isExpanded
    ? TABS
    : TABS.filter((t) => !["context", "insights"].includes(t) || tab === t)

  return (
    <Box flexDirection="column" width={width} height={height} borderStyle="single" borderColor={theme.surface1}>
      <OverviewBand sessionID={sessionID} width={width - 2} />

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
        {tabLabels.map((t) => (
          <Box key={t} paddingX={1}>
            <Text color={t === tab ? theme.cyan : theme.overlay} bold={t === tab}>
              {isExpanded ? t : t.slice(0, 4)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Content */}
      <Box flexDirection="column" height={Math.max(1, contentHeight)} paddingX={1} overflow="hidden">
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

        {tab === "context" && (
          <Box flexDirection="column">
            {contextData ? (
              contextData.split("\n").map((line, i) => (
                <Text key={i} color={theme.subtext} wrap="truncate-end">
                  {line}
                </Text>
              ))
            ) : (
              <Text color={theme.overlay} dimColor>
                Context unavailable
              </Text>
            )}
          </Box>
        )}

        {tab === "insights" && (
          <Box flexDirection="column">
            {insightsLoading ? (
              <Text color={theme.cyan}>Generating summary…</Text>
            ) : insights ? (
              insights.split("\n").map((line, i) => (
                <Text key={i} color={theme.subtext} wrap="truncate-end">
                  {line}
                </Text>
              ))
            ) : (
              <Text color={theme.overlay} dimColor>
                Run /summarize or /quality to populate this tab.
              </Text>
            )}
          </Box>
        )}
      </Box>

      <Box>
        <Text color={theme.surface2} dimColor>
          {isExpanded ? "tab/←→ switch · Ctrl+[/] resize" : "tab/←→ · Ctrl+] expand"}
        </Text>
      </Box>
    </Box>
  )
}
