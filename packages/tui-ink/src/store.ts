import { create } from "zustand"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

export interface Message {
  id: string
  role: "user" | "ai"
  content: string
}

export interface AppState {
  // Status
  status: "idle" | "generating" | "error"

  // Chat
  chatHistory: Message[]

  // Context
  activeContext: string[]

  // Project metadata
  projectName: string
  gitBranch: string

  // Server connection
  serverUrl: string
  directory: string | undefined
  serverHeaders: Record<string, string> | undefined
  currentSessionID: string

  // SDK client
  sdkClient: OpencodeClient | null

  // Actions
  addMessage: (role: Message["role"], content: string) => void
  appendStream: (chunk: string) => void
  setStatus: (status: AppState["status"]) => void
  setContext: (files: string[]) => void
  clearHistory: () => void
  sendMessage: (sessionID: string, text: string) => Promise<void>
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export const useAppStore = create<AppState>((set) => ({
  status: "idle",
  chatHistory: [],
  activeContext: [],
  projectName: "bettercode",
  gitBranch: "main",
  serverUrl: "",
  directory: undefined,
  serverHeaders: undefined,
  currentSessionID: "",
  sdkClient: null,

  addMessage: (role, content) =>
    set((s) => ({
      chatHistory: [...s.chatHistory, { id: genId(), role, content }],
    })),

  appendStream: (chunk) =>
    set((s) => {
      const history = [...s.chatHistory]
      const last = history[history.length - 1]
      if (last && last.role === "ai") {
        history[history.length - 1] = { ...last, content: last.content + chunk }
        return { chatHistory: history }
      }
      return { chatHistory: [...history, { id: genId(), role: "ai", content: chunk }] }
    }),

  setStatus: (status) => set({ status }),

  setContext: (files) => set({ activeContext: files }),

  clearHistory: () => set({ chatHistory: [] }),

  sendMessage: async (sessionID, text) => {
    const client = useAppStore.getState().sdkClient
    if (!client) return
    useAppStore.getState().setStatus("generating")
    try {
      // promptAsync returns immediately; the AI response arrives via SSE stream
      await client.session.promptAsync({
        sessionID,
        parts: [{ type: "text", text }],
      })
    } catch {
      useAppStore.getState().setStatus("error")
    }
  },
}))
