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
  ToolPart as ToolPartType,
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
import { registry } from "./commands/registry"
import type { CapabilityHook, CapabilityPlugin, CapabilitySkill } from "./types"

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
  skills: CapabilitySkill[]
  plugins: CapabilityPlugin[]
  hooks: CapabilityHook[]
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
  collapsedTools: Record<string, boolean>
  collapsedDiffs: Record<string, boolean>
  messagesLoaded: Record<string, boolean>
  messageDiff: Record<string, SnapshotFileDiff[]>
  messageDiffLoaded: Record<string, boolean>

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

  // Auto-accept all permissions for this session (no individual prompts)
  autoAcceptPermissions: boolean
  toggleAutoAcceptPermissions: () => void

  // Bootstrap retry tick — incrementing this re-triggers useSDK bootstrap
  reconnectTick: number
  retryBootstrap: () => void

  // Active primary agent
  mode: "plan" | "build"
  setMode: (mode: "plan" | "build") => void

  // Theme
  currentThemeName: string

  // Toasts
  toasts: Toast[]

  // Composer append from server events
  composerAppend: string

  // Transient: current number of visible input lines (for dock height)
  composerLines: number
  setComposerLines: (n: number) => void

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
  toggleToolCollapse: (partID: string) => void
  expandAllTools: (sessionID: string) => void
  collapseAllTools: (sessionID: string) => void
  toggleDiffCollapse: (messageID: string) => void

  upsertPermission: (req: PermissionRequest) => void
  removePermission: (sessionID: string, requestID: string) => void
  upsertQuestion: (req: QuestionRequest) => void
  removeQuestion: (sessionID: string, requestID: string) => void

  sendPrompt: (sessionID: string, text: string, files?: FilePartInput[]) => Promise<void>
  abortSession: (sessionID: string) => Promise<void>
  replyPermission: (requestID: string, reply: "once" | "always" | "reject") => Promise<void>
  replyQuestion: (requestID: string, answers: string[][]) => Promise<void>
  rejectQuestion: (requestID: string) => Promise<void>

  // Session management
  loadMessages: (sessionID: string) => Promise<void>
  loadMessageDiff: (sessionID: string, messageID: string, parentID?: string) => Promise<void>
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

export function parseCmd(text: string) {
  if (!text.startsWith("/")) return
  const idx = text.indexOf("\n")
  const head = idx === -1 ? text : text.slice(0, idx)
  const tail = idx === -1 ? "" : text.slice(idx + 1)
  const [cmd = "", ...rest] = head.split(" ")
  const name = cmd.slice(1)
  if (!name) return
  return {
    name,
    args: rest.join(" ") + (tail ? "\n" + tail : ""),
  }
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
  skills: [],
  plugins: [],
  hooks: [],
  config: {},
  lsp: [],
  mcp: {},
  vcs: undefined,
  sessions: [],
  sessionStatus: {},
  sessionDiff: {},
  messages: {},
  parts: {},
  collapsedTools: {},
  collapsedDiffs: {},
  messagesLoaded: {},
  messageDiff: {},
  messageDiffLoaded: {},
  scrollPos: {},
  permissions: {},
  questions: {},
  composerStatus: "idle",
  showThinking: false,
  autoAcceptPermissions: false,
  reconnectTick: 0,
  mode: "build",
  currentThemeName: DEFAULT_THEME,
  toasts: [],
  composerAppend: "",
  composerLines: 1,
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
  toggleAutoAcceptPermissions: () => set((prev) => ({ autoAcceptPermissions: !prev.autoAcceptPermissions })),
  retryBootstrap: () => set((prev) => ({ syncStatus: "loading", reconnectTick: prev.reconnectTick + 1 })),
  setTheme: (name) => set({ currentThemeName: name }),
  addToast: (t) => {
    const id = `${Date.now()}-${Math.random()}`
    set((prev) => ({ toasts: [...prev.toasts, { ...t, id }] }))
    setTimeout(() => useAppStore.getState().removeToast(id), t.duration)
  },
  removeToast: (id) => set((prev) => ({ toasts: prev.toasts.filter((t) => t.id !== id) })),
  setComposerAppend: (text) => set({ composerAppend: text }),
  setComposerLines: (n) => set({ composerLines: n }),
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
      const nextParts = { ...prev.parts }
      const nextCollapsed = { ...prev.collapsedTools }
      const nextDiff = { ...prev.messageDiff }
      const nextDiffLoaded = { ...prev.messageDiffLoaded }
      const nextCollapsedDiffs = { ...prev.collapsedDiffs }
      if (found) arr.splice(index, 1)
      for (const part of nextParts[messageID] ?? []) {
        if (part.type === "tool") delete nextCollapsed[part.id]
      }
      delete nextParts[messageID]
      delete nextDiff[messageID]
      delete nextDiffLoaded[messageID]
      delete nextCollapsedDiffs[messageID]
      return {
        messages: { ...prev.messages, [sessionID]: arr },
        parts: nextParts,
        collapsedTools: nextCollapsed,
        messageDiff: nextDiff,
        messageDiffLoaded: nextDiffLoaded,
        collapsedDiffs: nextCollapsedDiffs,
      }
    }),

  upsertPart: (part) =>
    set((prev) => {
      const arr = [...(prev.parts[part.messageID] ?? [])]
      const { found, index } = bsearch(arr, part.id, (x) => x.id)
      const nextCollapsed = { ...prev.collapsedTools }
      const old = found ? arr[index] : undefined
      if (old?.type !== "tool" || part.type !== "tool") delete nextCollapsed[part.id]
      if (found) arr[index] = part
      else arr.splice(index, 0, part)
      return { parts: { ...prev.parts, [part.messageID]: arr }, collapsedTools: nextCollapsed }
    }),

  removePart: (messageID, partID) =>
    set((prev) => {
      const arr = [...(prev.parts[messageID] ?? [])]
      const { found, index } = bsearch(arr, partID, (x) => x.id)
      const nextCollapsed = { ...prev.collapsedTools }
      delete nextCollapsed[partID]
      if (found) arr.splice(index, 1)
      return { parts: { ...prev.parts, [messageID]: arr }, collapsedTools: nextCollapsed }
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

  toggleToolCollapse: (partID) =>
    set((prev) => {
      const part = Object.values(prev.parts)
        .flat()
        .find((p): p is ToolPartType => p.type === "tool" && p.id === partID)
      if (!part) return prev
      const now = prev.collapsedTools[partID] ?? part.state.status === "completed"
      return { collapsedTools: { ...prev.collapsedTools, [partID]: !now } }
    }),

  expandAllTools: (sessionID) =>
    set((prev) => {
      const msg = [...(prev.messages[sessionID] ?? [])].reverse().find((m) => m.role === "assistant")
      if (!msg) return prev
      const tools = (prev.parts[msg.id] ?? []).filter((p): p is ToolPartType => p.type === "tool")
      if (tools.length === 0) return prev
      const next = { ...prev.collapsedTools }
      for (const part of tools) next[part.id] = false
      return { collapsedTools: next }
    }),

  collapseAllTools: (sessionID) =>
    set((prev) => {
      const msg = [...(prev.messages[sessionID] ?? [])].reverse().find((m) => m.role === "assistant")
      if (!msg) return prev
      const tools = (prev.parts[msg.id] ?? []).filter((p): p is ToolPartType => p.type === "tool")
      if (tools.length === 0) return prev
      const next = { ...prev.collapsedTools }
      for (const part of tools) next[part.id] = true
      return { collapsedTools: next }
    }),

  toggleDiffCollapse: (messageID) =>
    set((prev) => {
      const open = prev.collapsedDiffs[messageID] ?? true
      return { collapsedDiffs: { ...prev.collapsedDiffs, [messageID]: !open } }
    }),

  upsertPermission: (req) => {
    if (get().autoAcceptPermissions) {
      // Auto-accept mode: reply immediately without surfacing the prompt
      get().replyPermission(req.id, "always")
      return
    }
    set((prev) => {
      const arr = [...(prev.permissions[req.sessionID] ?? [])]
      const { found, index } = bsearch(arr, req.id, (x) => x.id)
      if (found) arr[index] = req
      else arr.splice(index, 0, req)
      return { permissions: { ...prev.permissions, [req.sessionID]: arr } }
    })
  },

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
    const { client, currentModel, currentAgent, mode, commands, providerConnected } = get()
    if (!client) return
    const cmd = parseCmd(text)
    // Guard: cannot send a regular prompt with no model/provider configured.
    // Slash commands (especially /provider) must still be allowed through.
    if (!cmd && !currentModel && providerConnected.length === 0) {
      get().addToast({
        title: "No provider connected",
        message: "Type /provider to configure an API key before sending a message.",
        variant: "warning",
        duration: 5000,
      })
      return
    }
    if (cmd?.name === "clear") return
    const local = cmd ? registry.all().find((item) => item.slash === cmd.name && item.enabled !== false) : undefined
    if (local) {
      local.action()
      return
    }
    const remote = cmd ? commands.find((item) => item.name === cmd.name) : undefined
    if (cmd && !remote) {
      get().addToast({
        title: "Unknown command",
        message: `/${cmd.name} is not available in this session.`,
        variant: "warning",
        duration: 3000,
      })
      return
    }
    try {
      set({ composerStatus: "generating" })
      if (remote && cmd) {
        await client.session.command({
          sessionID,
          command: cmd.name,
          arguments: cmd.args,
          ...(currentModel ? { model: `${currentModel.providerID}/${currentModel.modelID}` } : {}),
          agent: currentAgent ?? mode,
          ...(files?.length ? { parts: files } : {}),
        })
        return
      }
      await client.session.promptAsync({
        sessionID,
        parts: [{ type: "text", text }, ...(files ?? [])],
        ...(currentModel ? { model: currentModel } : {}),
        agent: currentAgent ?? mode,
      })
    } catch {
      set({ composerStatus: "error" })
      get().addToast({
        title: cmd ? "Command failed" : "Prompt failed",
        message: cmd ? `/${cmd.name} could not be executed.` : "The prompt could not be sent.",
        variant: "error",
        duration: 4000,
      })
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

  loadMessageDiff: async (sessionID, messageID, parentID) => {
    const { client, messageDiffLoaded } = get()
    if (!client) return
    if (messageDiffLoaded[messageID]) return
    set((prev) => ({ messageDiffLoaded: { ...prev.messageDiffLoaded, [messageID]: true } }))
    try {
      const res = await client.session.diff({
        sessionID,
        ...(parentID ? { messageID: parentID } : {}),
      })
      set((prev) => ({
        messageDiff: { ...prev.messageDiff, [messageID]: res.data ?? [] },
      }))
    } catch {
      set((prev) => {
        const next = { ...prev.messageDiffLoaded }
        delete next[messageID]
        return { messageDiffLoaded: next }
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
    const { client, messages, sessionStatus } = get()
    if (!client) return
    if (sessionStatus[sessionID]?.type !== "idle") {
      await client.session.abort({ sessionID }).catch(() => {})
    }
    const msg = [...(messages[sessionID] ?? [])].reverse().find((item) => item.role === "user")
    if (!msg) return
    await client.session.revert({ sessionID, messageID: msg.id }).catch(() => {})
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
    get().addToast({
      title: "Permission replied",
      message: reply === "always" ? "Always allow saved." : reply === "once" ? "Allowed once." : "Request rejected.",
      variant: reply === "reject" ? "warning" : "success",
      duration: 2500,
    })
  },

  replyQuestion: async (requestID, answers) => {
    const { client } = get()
    if (!client) return
    await client.question.reply({ requestID, answers }).catch(() => {})
    get().addToast({
      title: "Question answered",
      message: "Answer sent to the session.",
      variant: "success",
      duration: 2500,
    })
  },

  rejectQuestion: async (requestID) => {
    const { client } = get()
    if (!client) return
    await client.question.reject({ requestID }).catch(() => {})
    get().addToast({
      title: "Question rejected",
      message: "The session was told that the question was rejected.",
      variant: "warning",
      duration: 2500,
    })
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
