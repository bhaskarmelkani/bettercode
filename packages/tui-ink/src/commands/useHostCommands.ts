import { useEffect } from "react"
import { registry } from "./registry"
import { useAppStore } from "../store"
import { primaryKey } from "../keybindings"
import { runInsight } from "./insights"

export function useHostCommands() {
  const bindings = useAppStore((s) => s.keybindings)

  // Stable Zustand actions — only used at call time via getState()
  useEffect(() => {
    const unreg = [
      registry.register({
        id: "session.new",
        label: "New Session",
        description: "Start a fresh session",
        category: "Session",
        keybind: primaryKey(bindings, "newSession", ["global"]),
        slash: "new",
        action: () => useAppStore.getState().navigate({ type: "home" }),
      }),
      registry.register({
        id: "session.list",
        label: "Session List",
        description: "Browse and switch sessions",
        category: "Session",
        keybind: primaryKey(bindings, "sessionList", ["global"]),
        slash: "sessions",
        action: () => useAppStore.getState().pushDialog({ type: "session-list" }),
      }),
      registry.register({
        id: "session.interrupt",
        label: "Interrupt Session",
        description: "Abort the current running generation",
        category: "Session",
        slash: "interrupt",
        action: () => {
          const { currentSessionID, abortSession } = useAppStore.getState()
          if (currentSessionID) abortSession(currentSessionID)
        },
      }),
      registry.register({
        id: "session.undo",
        label: "Undo Previous Message",
        description: "Revert the last user turn in the current session",
        category: "Session",
        slash: "undo",
        action: () => {
          const { currentSessionID, revertSession } = useAppStore.getState()
          if (currentSessionID) revertSession(currentSessionID)
        },
      }),
      registry.register({
        id: "session.compact",
        label: "Compact Session",
        description: "Summarize the current session",
        category: "Session",
        slash: "compact",
        action: () => {
          const { currentSessionID, summarizeSession } = useAppStore.getState()
          if (currentSessionID) summarizeSession(currentSessionID)
        },
      }),
      registry.register({
        id: "model.switch",
        label: "Switch Model",
        description: "Pick a different model for the current session",
        category: "Model",
        slash: "model",
        action: () => useAppStore.getState().pushDialog({ type: "model-picker" }),
      }),
      registry.register({
        id: "agent.switch",
        label: "Switch Agent",
        description: "Pick a different agent for the current session",
        category: "Agent",
        slash: "agent",
        action: () => useAppStore.getState().pushDialog({ type: "agent-picker" }),
      }),
      registry.register({
        id: "provider.manage",
        label: "Manage Providers",
        description: "Configure AI providers and API keys",
        category: "Provider",
        slash: "provider",
        action: () => useAppStore.getState().pushDialog({ type: "provider" }),
      }),
      registry.register({
        id: "mcp.view",
        label: "MCP Servers",
        description: "View and manage MCP server connections",
        category: "MCP",
        slash: "mcp",
        action: () => useAppStore.getState().pushDialog({ type: "mcp" }),
      }),
      registry.register({
        id: "theme.select",
        label: "Select Theme",
        description: "Change the color theme",
        category: "App",
        slash: "theme",
        action: () => useAppStore.getState().pushDialog({ type: "theme" }),
      }),
      registry.register({
        id: "thinking.toggle",
        label: "Toggle Reasoning",
        description: "Show or hide reasoning/thinking blocks",
        category: "App",
        slash: "thinking",
        action: () => {
          const s = useAppStore.getState()
          s.setShowThinking(!s.showThinking)
        },
      }),
      registry.register({
        id: "permission.auto-accept",
        label: "Toggle Auto-Accept",
        description: "Auto-accept all permission requests for this session",
        category: "App",
        slash: "auto-accept",
        action: () => useAppStore.getState().toggleAutoAcceptPermissions(),
      }),
      registry.register({
        id: "help",
        label: "Help / Commands",
        description: "Open the command palette",
        category: "App",
        keybind: primaryKey(bindings, "commandPalette", ["global"]),
        action: () => useAppStore.getState().pushDialog({ type: "command-palette" }),
      }),
      registry.register({
        id: "help.shortcuts",
        label: "Keyboard Shortcuts",
        description: "Show keyboard shortcuts reference",
        category: "App",
        slash: "help",
        action: () => useAppStore.getState().pushDialog({ type: "help" }),
      }),
      registry.register({
        id: "exit",
        label: "Exit",
        description: "Quit bettercode",
        category: "App",
        keybind: primaryKey(bindings, "exit", ["global"]),
        action: () => process.exit(0),
      }),
      // Context pane commands (M4)
      registry.register({
        id: "context.show",
        label: "Show Context Breakdown",
        description: "Open the context tab with a breakdown of token usage and recent turns",
        category: "Context",
        slash: "context",
        action: () => {
          const s = useAppStore.getState()
          if (s.sidebarMode === "collapsed") s.setSidebarMode("compact")
        },
      }),
      registry.register({
        id: "context.summarize",
        label: "Summarize Session",
        description: "Generate an AI summary of the current session into the insights tab",
        category: "Context",
        slash: "summarize",
        action: () => {
          const s = useAppStore.getState()
          if (s.sidebarMode === "collapsed") s.setSidebarMode("compact")
          void runInsight("summary", s.currentSessionID)
        },
      }),
      registry.register({
        id: "context.quality",
        label: "Session Quality",
        description: "Evaluate session quality with heuristics and AI",
        category: "Context",
        slash: "quality",
        action: () => {
          const s = useAppStore.getState()
          if (s.sidebarMode === "collapsed") s.setSidebarMode("compact")
          void runInsight("quality", s.currentSessionID)
        },
      }),
      registry.register({
        id: "worktree.switch",
        label: "Switch Worktree",
        description: "Switch between git worktrees",
        category: "Session",
        slash: "worktree",
        action: () => useAppStore.getState().pushDialog({ type: "worktree-picker" }),
      }),
    ]
    return () => unreg.forEach((f) => f())
  }, [bindings])
}
