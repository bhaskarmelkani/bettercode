import { useEffect } from "react"
import { registry } from "./registry"
import { useAppStore } from "../store"

export function useHostCommands() {
  // Stable Zustand actions — only used at call time via getState()
  useEffect(() => {
    const unreg = [
      registry.register({
        id: "session.new",
        label: "New Session",
        description: "Start a fresh session",
        category: "Session",
        keybind: "ctrl+n",
        slash: "new",
        action: () => useAppStore.getState().navigate({ type: "home" }),
      }),
      registry.register({
        id: "session.list",
        label: "Session List",
        description: "Browse and switch sessions",
        category: "Session",
        keybind: "ctrl+s",
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
        id: "help",
        label: "Help / Commands",
        description: "Open the command palette",
        category: "App",
        keybind: "ctrl+k",
        slash: "help",
        action: () => useAppStore.getState().pushDialog({ type: "command-palette" }),
      }),
      registry.register({
        id: "exit",
        label: "Exit",
        description: "Quit bettercode",
        category: "App",
        keybind: "ctrl+c",
        action: () => process.exit(0),
      }),
    ]
    return () => unreg.forEach((f) => f())
  }, [])
}
