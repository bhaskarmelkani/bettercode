import { create } from "zustand"
import type {
  OpencodeClient,
  Agent,
  Command,
  Config,
  LspStatus,
  McpStatus,
  Message,
  Part,
  PermissionRequest,
  Provider,
  QuestionRequest,
  Session,
  SessionStatus,
  SnapshotFileDiff,
  VcsInfo,
  ProviderAuthMethod,
  ProviderAuthAuthorization,
  ApiAuth,
  FilePartInput,
} from "@opencode-ai/sdk/v2"
import { DEFAULT_THEME } from "./theme"
import * as Frecency from "./frecency"

export type SyncStatus = "loading" | "partial" | "complete"

export type Route =
  | { type: "home" }
  | { type: "session"; sessionID: string }
  | { type: "plugin"; name: string; params?: Record<string, unknown> }

export type Dialog =
  | { type: "session-list" }
  | { type: "command-palette" }
  | { type: "confirm"; message: string; onConfirm: () => void }
  | { type: "provider" }
  | { type: "model-picker" }
  | { type: "agent-picker" }
  | { type: "mcp" }
  | { type: "theme" }
  | { type: "help" }
  | { type: "alert"; message: string; title?: string }

export type Toast = {
  id: string
  title?: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  duration: number
}

export interface AppState {
  // SDK
  client: OpencodeClient | null

  // Sync lifecycle
  syncStatus: SyncStatus

  // Server identity
  serverUrl: string
  directory: string | undefined
  serverHeaders: Record<string, string> | undefined
  currentSessionID: string

  // Bootstrap data
  providers: Provider[]
  providerDefaults: Record<string, string>
  providerConnected: string[]
  providerAuth: Record<string, ProviderAuthMethod[]>
  agents: Agent[]
  commands: Command[]
  config: Config
  lsp: LspStatus[]
  mcp: Record<string, McpStatus>
  vcs: VcsInfo | undefined

  // Session data
  sessions: Session[]
  sessionStatus: Record<string, SessionStatus>
  sessionDiff: Record<string, SnapshotFileDiff[]>

  // Messages + parts (keyed by sessionID / messageID)
  messages: Record<string, Message[]>
  parts: Record<string, Part[]>
  messagesLoaded: Record<string, boolean>

  // Per-session scroll position (message offset from bottom)
  scrollPos: Record<string, number>

  // Permissions + questions (keyed by sessionID)
  permissions: Record<string, PermissionRequest[]>
  questions: Record<string, QuestionRequest[]>

  // Composer status (used by legacy stream rendering)
  composerStatus: "idle" | "generating" | "error"

  // Model / agent selection
  currentModel: { providerID: string; modelID: string } | undefined
  currentAgent: string | undefined
  recentModels: Array<{ providerID: string; modelID: string }>

  // Display toggles
  showThinking: boolean

  // Composer mode
  mode: "plan" | "build"
  setMode: (mode: "plan" | "build") => void

  // Theme
  currentThemeName: string

  // Toasts
  toasts: Toast[]

  // Composer append from server events
  composerAppend: string

  // Prompt history (persisted across sessions)
  promptHistory: string[]
  promptStash: string | null
  pushPromptHistory: (text: string) => void
  setPromptStash: (text: string | null) => void

  // Frecency (persisted)
  frecency: Frecency.Store
  trackFrecency: (key: string) => void

  // Router
  route: Route
  navigate: (r: Route) => void

  // Dialog stack
  dialogs: Dialog[]
  pushDialog: (d: Dialog) => void
  popDialog: () => void

  // Actions
  setClient: (c: OpencodeClient) => void
  setSyncStatus: (s: SyncStatus) => void
  setComposerStatus: (s: AppState["composerStatus"]) => void
  setShowThinking: (v: boolean) => void
  setCurrentModel: (m: { providerID: string; modelID: string } | undefined) => void
  setCurrentAgent: (a: string | undefined) => void
  setTheme: (name: string) => void

  // Toast actions
  addToast: (t: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
  setComposerAppend: (text: string) => void

  upsertSession: (s: Session) => void
  removeSession: (id: string) => void
  setSessionStatus: (id: string, status: SessionStatus) => void
  setSessionDiff: (id: string, diff: SnapshotFileDiff[]) => void

  upsertMessage: (msg: Message) => void
  removeMessage: (sessionID: string, messageID: string) => void
  upsertPart: (part: Part) => void
  removePart: (messageID: string, partID: string) => void
  appendPartDelta: (messageID: string, partID: string, field: string, delta: string) => void

  upsertPermission: (req: PermissionRequest) => void
  removePermission: (sessionID: string, requestID: string) => void
  upsertQuestion: (req: QuestionRequest) => void
  removeQuestion: (sessionID: string, requestID: string) => void

  sendPrompt: (sessionID: string, text: string, files?: FilePartInput[]) => Promise<void>
  abortSession: (sessionID: string) => Promise<void>
  replyPermission: (requestID: string, reply: "once" | "always" | "reject") => Promise<void>
  replyQuestion: (requestID: string, answers: string[][]) => Promise<void>

  // Session management
  loadMessages: (sessionID: string) => Promise<void>
  setScrollPos: (sessionID: string, pos: number) => void
  createSession: () => Promise<Session | null>
  renameSession: (sessionID: string, title: string) => Promise<void>
  deleteSession: (sessionID: string) => Promise<void>
  forkSession: (sessionID: string) => Promise<Session | null>
  shareSession: (sessionID: string) => Promise<string | null>
  summarizeSession: (sessionID: string) => Promise<void>
  revertSession: (sessionID: string) => Promise<void>

  // Provider / auth
  setProviderApiKey: (providerID: string, key: string, metadata?: Record<string, string>) => Promise<void>
  oauthAuthorize: (
    providerID: string,
    methodIndex: number,
    inputs?: Record<string, string>,
  ) => Promise<ProviderAuthAuthorization | null>
  oauthCallback: (providerID: string, methodIndex: number, code?: string) => Promise<boolean>
  refreshProviders: () => Promise<void>

  // MCP
  connectMcp: (name: string) => Promise<void>
  disconnectMcp: (name: string) => Promise<void>
  refreshMcp: () => Promise<void>
}

function bsearch<T>(arr: T[], id: string, key: (v: T) => string): { found: boolean; index: number } {
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const item = arr[mid]
    if (!item) break
    const k = key(item)
    if (k === id) return { found: true, index: mid }
    if (k < id) lo = mid + 1
    else hi = mid - 1
  }
  return { found: false, index: lo }
}

export const useAppStore = create<AppState>((set, get) => ({
  client: null,
  syncStatus: "loading",
  serverUrl: "",
  directory: undefined,
  serverHeaders: undefined,
  currentSessionID: "",
  providers: [],
  providerDefaults: {},
  providerConnected: [],
  providerAuth: {},
  agents: [],
  commands: [],
  config: {},
  lsp: [],
  mcp: {},
  vcs: undefined,
  sessions: [],
  sessionStatus: {},
  sessionDiff: {},
  messages: {},
  parts: {},
  messagesLoaded: {},
  scrollPos: {},
  permissions: {},
  questions: {},
  composerStatus: "idle",
  showThinking: false,
  mode: "build",
  currentThemeName: DEFAULT_THEME,
  toasts: [],
  composerAppend: "",
  currentModel: undefined,
  currentAgent: undefined,
  recentModels: [],
  promptHistory: [],
  promptStash: null,
  frecency: {},

  route: { type: "home" },
  dialogs: [],

  setClient: (c) => set({ client: c }),
  setSyncStatus: (s) => set({ syncStatus: s }),
  setComposerStatus: (s) => set({ composerStatus: s }),
  setShowThinking: (v) => set({ showThinking: v }),
  setTheme: (name) => set({ currentThemeName: name }),
  addToast: (t) => {
    const id = `${Date.now()}-${Math.random()}`
    set((prev) => ({ toasts: [...prev.toasts, { ...t, id }] }))
    setTimeout(() => useAppStore.getState().removeToast(id), t.duration)
  },
  removeToast: (id) => set((prev) => ({ toasts: prev.toasts.filter((t) => t.id !== id) })),
  setComposerAppend: (text) => set({ composerAppend: text }),
  pushPromptHistory: (text) =>
    set((prev) => {
      const deduped = [text, ...prev.promptHistory.filter((h) => h !== text)].slice(0, 200)
      return { promptHistory: deduped }
    }),
  setPromptStash: (text) => set({ promptStash: text }),
  trackFrecency: (key) => set((prev) => ({ frecency: Frecency.access(prev.frecency, key) })),
  setCurrentModel: (m) =>
    set((prev) => {
      if (!m) return { currentModel: undefined }
      const recent = [
        m,
        ...prev.recentModels.filter((r) => !(r.providerID === m.providerID && r.modelID === m.modelID)),
      ].slice(0, 10)
      return { currentModel: m, recentModels: recent }
    }),
  setCurrentAgent: (a) => set({ currentAgent: a }),
  setMode: (m) => set({ mode: m }),

  navigate: (r) => set({ route: r }),
  pushDialog: (d) => set((prev) => ({ dialogs: [...prev.dialogs, d] })),
  popDialog: () => set((prev) => ({ dialogs: prev.dialogs.slice(0, -1) })),

  upsertSession: (s) =>
    set((prev) => {
      const arr = [...prev.sessions]
      const { found, index } = bsearch(arr, s.id, (x) => x.id)
      if (found) arr[index] = s
      else arr.splice(index, 0, s)
      return { sessions: arr }
    }),

  removeSession: (id) =>
    set((prev) => {
      const arr = [...prev.sessions]
      const { found, index } = bsearch(arr, id, (x) => x.id)
      if (found) arr.splice(index, 1)
      return { sessions: arr }
    }),

  setSessionStatus: (id, status) => set((prev) => ({ sessionStatus: { ...prev.sessionStatus, [id]: status } })),

  setSessionDiff: (id, diff) => set((prev) => ({ sessionDiff: { ...prev.sessionDiff, [id]: diff } })),

  upsertMessage: (msg) =>
    set((prev) => {
      const arr = [...(prev.messages[msg.sessionID] ?? [])]
      const { found, index } = bsearch(arr, msg.id, (x) => x.id)
      if (found) arr[index] = msg
      else arr.splice(index, 0, msg)
      return { messages: { ...prev.messages, [msg.sessionID]: arr } }
    }),

  removeMessage: (sessionID, messageID) =>
    set((prev) => {
      const arr = [...(prev.messages[sessionID] ?? [])]
      const { found, index } = bsearch(arr, messageID, (x) => x.id)
      if (found) arr.splice(index, 1)
      return { messages: { ...prev.messages, [sessionID]: arr } }
    }),

  upsertPart: (part) =>
    set((prev) => {
      const arr = [...(prev.parts[part.messageID] ?? [])]
      const { found, index } = bsearch(arr, part.id, (x) => x.id)
      if (found) arr[index] = part
      else arr.splice(index, 0, part)
      return { parts: { ...prev.parts, [part.messageID]: arr } }
    }),

  removePart: (messageID, partID) =>
    set((prev) => {
      const arr = [...(prev.parts[messageID] ?? [])]
      const { found, index } = bsearch(arr, partID, (x) => x.id)
      if (found) arr.splice(index, 1)
      return { parts: { ...prev.parts, [messageID]: arr } }
    }),

  appendPartDelta: (messageID, partID, field, delta) =>
    set((prev) => {
      const arr = prev.parts[messageID]
      if (!arr) return prev
      const { found, index } = bsearch([...arr], partID, (x) => x.id)
      if (!found) return prev
      const next = [...arr]
      const part = { ...next[index] } as Record<string, unknown>
      const existing = part[field] as string | undefined
      part[field] = (existing ?? "") + delta
      next[index] = part as Part
      return { parts: { ...prev.parts, [messageID]: next } }
    }),

  upsertPermission: (req) =>
    set((prev) => {
      const arr = [...(prev.permissions[req.sessionID] ?? [])]
      const { found, index } = bsearch(arr, req.id, (x) => x.id)
      if (found) arr[index] = req
      else arr.splice(index, 0, req)
      return { permissions: { ...prev.permissions, [req.sessionID]: arr } }
    }),

  removePermission: (sessionID, requestID) =>
    set((prev) => {
      const arr = [...(prev.permissions[sessionID] ?? [])]
      const { found, index } = bsearch(arr, requestID, (x) => x.id)
      if (found) arr.splice(index, 1)
      return { permissions: { ...prev.permissions, [sessionID]: arr } }
    }),

  upsertQuestion: (req) =>
    set((prev) => {
      const arr = [...(prev.questions[req.sessionID] ?? [])]
      const { found, index } = bsearch(arr, req.id, (x) => x.id)
      if (found) arr[index] = req
      else arr.splice(index, 0, req)
      return { questions: { ...prev.questions, [req.sessionID]: arr } }
    }),

  removeQuestion: (sessionID, requestID) =>
    set((prev) => {
      const arr = [...(prev.questions[sessionID] ?? [])]
      const { found, index } = bsearch(arr, requestID, (x) => x.id)
      if (found) arr.splice(index, 1)
      return { questions: { ...prev.questions, [sessionID]: arr } }
    }),

  sendPrompt: async (sessionID, text, files) => {
    const { client, currentModel, currentAgent } = get()
    if (!client) return
    set({ composerStatus: "generating" })
    const parts = [{ type: "text" as const, text }, ...(files ?? [])]
    try {
      await client.session.promptAsync({
        sessionID,
        parts,
        ...(currentModel ? { model: currentModel } : {}),
        ...(currentAgent ? { agent: currentAgent } : {}),
      })
    } catch {
      set({ composerStatus: "error" })
    }
  },

  loadMessages: async (sessionID) => {
    const { client } = get()
    if (!client) return
    if (get().messagesLoaded[sessionID]) return
    set((prev) => ({ messagesLoaded: { ...prev.messagesLoaded, [sessionID]: true } }))
    try {
      const res = await client.session.messages({ sessionID })
      const items = res.data ?? []
      for (const item of items) {
        useAppStore.getState().upsertMessage(item.info)
        for (const part of item.parts) {
          useAppStore.getState().upsertPart(part)
        }
      }
    } catch {
      set((prev) => {
        const next = { ...prev.messagesLoaded }
        delete next[sessionID]
        return { messagesLoaded: next }
      })
    }
  },

  setScrollPos: (sessionID, pos) => set((prev) => ({ scrollPos: { ...prev.scrollPos, [sessionID]: pos } })),

  createSession: async () => {
    const { client, directory } = get()
    if (!client) return null
    const res = await client.session.create(directory ? { directory } : {}).catch(() => null)
    return res?.data ?? null
  },

  renameSession: async (sessionID, title) => {
    const { client } = get()
    if (!client) return
    await client.session.update({ sessionID, title }).catch(() => {})
  },

  deleteSession: async (sessionID) => {
    const { client } = get()
    if (!client) return
    await client.session.delete({ sessionID }).catch(() => {})
  },

  forkSession: async (sessionID) => {
    const { client } = get()
    if (!client) return null
    const res = await client.session.fork({ sessionID }).catch(() => null)
    return res?.data ?? null
  },

  shareSession: async (sessionID) => {
    const { client } = get()
    if (!client) return null
    const res = await client.session.share({ sessionID }).catch(() => null)
    return res?.data?.share?.url ?? null
  },

  summarizeSession: async (sessionID) => {
    const { client } = get()
    if (!client) return
    await client.session.summarize({ sessionID }).catch(() => {})
  },

  revertSession: async (sessionID) => {
    const { client } = get()
    if (!client) return
    await client.session.revert({ sessionID }).catch(() => {})
  },

  abortSession: async (sessionID) => {
    const { client } = get()
    if (!client) return
    await client.session.abort({ sessionID }).catch(() => {})
  },

  replyPermission: async (requestID, reply) => {
    const { client } = get()
    if (!client) return
    await client.permission.reply({ requestID, reply }).catch(() => {})
  },

  replyQuestion: async (requestID, answers) => {
    const { client } = get()
    if (!client) return
    await client.question.reply({ requestID, answers }).catch(() => {})
  },

  setProviderApiKey: async (providerID, key, metadata) => {
    const { client } = get()
    if (!client) return
    const auth: ApiAuth = { type: "api", key, ...(metadata ? { metadata } : {}) }
    await client.auth.set({ providerID, auth }).catch(() => {})
    await get().refreshProviders()
  },

  oauthAuthorize: async (providerID, methodIndex, inputs) => {
    const { client } = get()
    if (!client) return null
    const res = await client.provider.oauth
      .authorize({
        providerID,
        method: methodIndex,
        ...(inputs ? { inputs } : {}),
      })
      .catch(() => null)
    return res?.data ?? null
  },

  oauthCallback: async (providerID, methodIndex, code) => {
    const { client } = get()
    if (!client) return false
    const res = await client.provider.oauth
      .callback({
        providerID,
        method: methodIndex,
        ...(code ? { code } : {}),
      })
      .catch(() => null)
    if (!res || res.error) return false
    await get().refreshProviders()
    return true
  },

  refreshProviders: async () => {
    const { client, directory } = get()
    if (!client) return
    const q = directory ? { directory } : {}
    const [providerList, providerAuth] = await Promise.all([
      client.provider.list(q).then((r) => r.data ?? { all: [], default: {}, connected: [] }),
      client.provider.auth(q).then((r) => r.data ?? {}),
    ])
    set({
      providers: providerList.all,
      providerDefaults: providerList.default,
      providerConnected: providerList.connected,
      providerAuth,
    })
  },

  connectMcp: async (name) => {
    const { client, directory } = get()
    if (!client) return
    const q = directory ? { directory } : {}
    await client.mcp.connect({ name, ...q }).catch(() => {})
    await get().refreshMcp()
  },

  disconnectMcp: async (name) => {
    const { client, directory } = get()
    if (!client) return
    const q = directory ? { directory } : {}
    await client.mcp.disconnect({ name, ...q }).catch(() => {})
    await get().refreshMcp()
  },

  refreshMcp: async () => {
    const { client, directory } = get()
    if (!client) return
    const q = directory ? { directory } : {}
    const mcp = await client.mcp
      .status(q)
      .then((r) => r.data ?? {})
      .catch(() => get().mcp)
    set({ mcp })
  },
}))
