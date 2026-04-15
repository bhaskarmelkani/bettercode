/**
 * Store reducer tests for bettercode TUI.
 * Tests session, message, part, permission, question, dialog, and route state.
 */
import { describe, test, expect, beforeEach } from "bun:test"
import { getContextUsage, useAppStore } from "../src/store"
import type { Session, Message, Part, PermissionRequest, Provider, QuestionRequest } from "@opencode-ai/sdk/v2"
import { registry } from "../src/commands/registry"

function makeSession(id: string, title?: string): Session {
  return { id, title: title ?? `Session ${id}` } as Session
}

function makeMessage(id: string, sessionID: string, role: "user" | "assistant"): Message {
  return { id, sessionID, role } as Message
}

function makeAssistant(
  id: string,
  sessionID: string,
  tokens: Partial<Extract<Message, { role: "assistant" }>["tokens"]>,
  total?: number,
): Message {
  return {
    id,
    sessionID,
    role: "assistant",
    providerID: "openai",
    modelID: "gpt-5.4",
    mode: "build",
    agent: "build",
    path: { cwd: "/tmp", root: "/tmp" },
    cost: 0,
    tokens: {
      input: tokens.input ?? 0,
      output: tokens.output ?? 0,
      reasoning: tokens.reasoning ?? 0,
      cache: {
        read: tokens.cache?.read ?? 0,
        write: tokens.cache?.write ?? 0,
      },
      ...(total ? { total } : {}),
    },
  } as Message
}

function makeProvider(context: number): Provider {
  return {
    id: "openai",
    name: "OpenAI",
    source: "api",
    env: [],
    options: {},
    models: {
      "gpt-5.4": {
        name: "GPT-5.4",
        cost: {
          input: 0,
          output: 0,
          cache: { read: 0, write: 0 },
        },
        limit: {
          context,
          output: 8192,
        },
        status: "active",
        options: {},
        headers: {},
        release_date: "2026-01-01",
      },
    },
  } as Provider
}

function makePart(id: string, messageID: string, type: string): Part {
  return { id, messageID, type, sessionID: "s1" } as unknown as Part
}

function makeTool(id: string, messageID: string, status: "pending" | "running" | "completed" | "error" = "completed"): Part {
  return {
    id,
    messageID,
    sessionID: "s1",
    type: "tool",
    callID: `call-${id}`,
    tool: "Bash",
    state:
      status === "completed"
        ? {
            status,
            input: { command: "ls" },
            output: "file1.ts\nfile2.ts",
            title: "ls",
            metadata: {},
            time: { start: 1, end: 2 },
          }
        : status === "running"
          ? { status, input: { command: "ls" }, time: { start: 1 } }
          : status === "error"
            ? { status, input: { command: "ls" }, error: "boom", time: { start: 1, end: 2 } }
            : { status, input: { command: "ls" }, raw: "ls" },
  } as unknown as Part
}

function makePermission(id: string, sessionID: string): PermissionRequest {
  return { id, sessionID, title: "Test permission", description: "Allow?", command: "cmd" } as unknown as PermissionRequest
}

function makeQuestion(id: string, sessionID: string): QuestionRequest {
  return { id, sessionID, title: "Test question", message: "Continue?" } as unknown as QuestionRequest
}

// Reset the store state before each test to avoid leakage between tests.
function resetStore() {
  useAppStore.setState({
    client: null,
    syncStatus: "loading",
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
    lastSeen: {},
    messageCursor: {},
    permissions: {},
    questions: {},
    composerStatus: "idle",
    dialogs: [],
    route: { type: "home" },
    toasts: [],
    promptHistory: [],
    promptStash: null,
    frecency: {},
    providers: [],
    agents: [],
    commands: [],
    skills: [],
    plugins: [],
    hooks: [],
    config: {},
    lsp: [],
    mcp: {},
    vcs: undefined,
    currentModel: undefined,
    currentAgent: undefined,
    recentModels: [],
    showThinking: false,
    currentThemeName: "catppuccin-mocha",
    composerAppend: "",
    composerSeed: null,
  })
}

describe("store — sessions", () => {
  beforeEach(resetStore)

  test("upsertSession inserts a new session in sorted order", () => {
    const s1 = makeSession("aaa")
    const s2 = makeSession("bbb")
    useAppStore.getState().upsertSession(s2)
    useAppStore.getState().upsertSession(s1)
    const { sessions } = useAppStore.getState()
    expect(sessions.map((s) => s.id)).toEqual(["aaa", "bbb"])
  })

  test("upsertSession updates an existing session", () => {
    const s1 = makeSession("aaa", "Original")
    useAppStore.getState().upsertSession(s1)
    const updated = makeSession("aaa", "Updated")
    useAppStore.getState().upsertSession(updated)
    const { sessions } = useAppStore.getState()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.title).toBe("Updated")
  })

  test("removeSession removes the correct session", () => {
    useAppStore.getState().upsertSession(makeSession("aaa"))
    useAppStore.getState().upsertSession(makeSession("bbb"))
    useAppStore.getState().upsertSession(makeSession("ccc"))
    useAppStore.getState().removeSession("bbb")
    const { sessions } = useAppStore.getState()
    expect(sessions.map((s) => s.id)).toEqual(["aaa", "ccc"])
  })

  test("removeSession is a no-op for unknown ID", () => {
    useAppStore.getState().upsertSession(makeSession("aaa"))
    useAppStore.getState().removeSession("zzz")
    expect(useAppStore.getState().sessions).toHaveLength(1)
  })
})

describe("store — messages", () => {
  beforeEach(resetStore)

  test("upsertMessage inserts messages in sorted order by id", () => {
    const m1 = makeMessage("m1", "s1", "user")
    const m2 = makeMessage("m2", "s1", "assistant")
    useAppStore.getState().upsertMessage(m2)
    useAppStore.getState().upsertMessage(m1)
    const msgs = useAppStore.getState().messages["s1"] ?? []
    expect(msgs.map((m) => m.id)).toEqual(["m1", "m2"])
  })

  test("upsertMessage updates existing message", () => {
    const m1 = makeMessage("m1", "s1", "user")
    useAppStore.getState().upsertMessage(m1)
    const updated = { ...m1, role: "assistant" as const }
    useAppStore.getState().upsertMessage(updated)
    const msgs = useAppStore.getState().messages["s1"] ?? []
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.role).toBe("assistant")
  })

  test("removeMessage removes the correct message", () => {
    useAppStore.getState().upsertMessage(makeMessage("m1", "s1", "user"))
    useAppStore.getState().upsertMessage(makeMessage("m2", "s1", "assistant"))
    useAppStore.getState().removeMessage("s1", "m1")
    const msgs = useAppStore.getState().messages["s1"] ?? []
    expect(msgs.map((m) => m.id)).toEqual(["m2"])
  })

  test("messages are stored per session", () => {
    useAppStore.getState().upsertMessage(makeMessage("m1", "sessionA", "user"))
    useAppStore.getState().upsertMessage(makeMessage("m2", "sessionB", "assistant"))
    expect((useAppStore.getState().messages["sessionA"] ?? []).map((m) => m.id)).toEqual(["m1"])
    expect((useAppStore.getState().messages["sessionB"] ?? []).map((m) => m.id)).toEqual(["m2"])
  })
})

describe("store — parts", () => {
  beforeEach(resetStore)

  test("upsertPart inserts parts in sorted order", () => {
    const p1 = makePart("p1", "m1", "text")
    const p2 = makePart("p2", "m1", "tool")
    useAppStore.getState().upsertPart(p2)
    useAppStore.getState().upsertPart(p1)
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect(parts.map((p) => p.id)).toEqual(["p1", "p2"])
  })

  test("upsertPart updates existing part", () => {
    const p1 = makePart("p1", "m1", "text")
    useAppStore.getState().upsertPart(p1)
    const updated = { ...p1, type: "tool" }
    useAppStore.getState().upsertPart(updated as Part)
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect(parts).toHaveLength(1)
    expect(parts[0]!.type).toBe("tool")
  })

  test("appendPartDelta appends text to existing part field", () => {
    const p1 = { id: "p1", messageID: "m1", type: "text", text: "Hello", sessionID: "s1" } as unknown as Part
    useAppStore.getState().upsertPart(p1)
    useAppStore.getState().appendPartDelta("m1", "p1", "text", " World")
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect((parts[0] as any).text).toBe("Hello World")
  })

  test("appendPartDelta creates field if it doesn't exist", () => {
    const p1 = { id: "p1", messageID: "m1", type: "text", sessionID: "s1" } as unknown as Part
    useAppStore.getState().upsertPart(p1)
    useAppStore.getState().appendPartDelta("m1", "p1", "text", "Start")
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect((parts[0] as any).text).toBe("Start")
  })

  test("appendPartDelta is a no-op for unknown part", () => {
    useAppStore.getState().appendPartDelta("m1", "unknown", "text", "x")
    // Should not throw
    expect(useAppStore.getState().parts["m1"]).toBeUndefined()
  })

  test("removePart removes the correct part", () => {
    useAppStore.getState().upsertPart(makePart("p1", "m1", "text"))
    useAppStore.getState().upsertPart(makePart("p2", "m1", "tool"))
    useAppStore.getState().removePart("m1", "p1")
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect(parts.map((p) => p.id)).toEqual(["p2"])
  })

  test("toggleToolCollapse flips tool collapse state", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    expect(useAppStore.getState().collapsedTools["t1"]).toBeUndefined()
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(true)
  })

  test("removePart clears collapse state for tool parts", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
    useAppStore.getState().removePart("m1", "t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBeUndefined()
  })
})

describe("store — context usage", () => {
  beforeEach(resetStore)

  test("returns undefined without a matching model limit", () => {
    useAppStore.setState({
      messages: { s1: [makeAssistant("m1", "s1", { input: 20_000, output: 5_000 })] },
    })
    expect(getContextUsage(useAppStore.getState(), "s1")).toBeUndefined()
  })

  test("uses assistant total tokens when available", () => {
    useAppStore.setState({
      providers: [makeProvider(200_000)],
      messages: { s1: [makeAssistant("m1", "s1", { input: 10_000, output: 2_000 }, 150_000)] },
    })

    expect(getContextUsage(useAppStore.getState(), "s1")).toEqual({
      used: 150_000,
      max: 200_000,
      percent: 75,
    })
  })

  test("falls back to summed tokens when total is missing", () => {
    useAppStore.setState({
      providers: [makeProvider(100_000)],
      messages: {
        s1: [
          makeAssistant("m1", "s1", { input: 12_000, output: 3_000 }),
          makeAssistant("m2", "s1", { input: 40_000, output: 5_000, reasoning: 2_000, cache: { read: 3_000, write: 0 } }),
        ],
      },
    })

    expect(getContextUsage(useAppStore.getState(), "s1")).toEqual({
      used: 50_000,
      max: 100_000,
      percent: 50,
    })
  })
})

describe("store — tool groups", () => {
  beforeEach(resetStore)

  test("collapseAllTools and expandAllTools affect the last assistant message", () => {
    useAppStore.getState().upsertMessage(makeMessage("m1", "s1", "assistant"))
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().upsertPart(makeTool("t2", "m1"))
    useAppStore.getState().collapseAllTools("s1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(true)
    expect(useAppStore.getState().collapsedTools["t2"]).toBe(true)
    useAppStore.getState().expandAllTools("s1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
    expect(useAppStore.getState().collapsedTools["t2"]).toBe(false)
  })

  test("removeMessage clears tool collapse state and parts", () => {
    useAppStore.getState().upsertMessage(makeMessage("m1", "s1", "assistant"))
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
    useAppStore.getState().removeMessage("s1", "m1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBeUndefined()
    expect(useAppStore.getState().parts["m1"]).toBeUndefined()
  })
})

describe("store — permissions", () => {
  beforeEach(resetStore)

  test("upsertPermission adds permission to session", () => {
    const req = makePermission("req1", "s1")
    useAppStore.getState().upsertPermission(req)
    expect(useAppStore.getState().permissions["s1"]).toHaveLength(1)
  })

  test("upsertPermission updates existing permission", () => {
    const req = makePermission("req1", "s1")
    useAppStore.getState().upsertPermission(req)
    const updated = { ...req, title: "Updated" }
    useAppStore.getState().upsertPermission(updated as PermissionRequest)
    const perms = useAppStore.getState().permissions["s1"] ?? []
    expect(perms).toHaveLength(1)
    expect(perms[0]!.title).toBe("Updated")
  })

  test("removePermission removes the correct permission", () => {
    useAppStore.getState().upsertPermission(makePermission("req1", "s1"))
    useAppStore.getState().upsertPermission(makePermission("req2", "s1"))
    useAppStore.getState().removePermission("s1", "req1")
    const perms = useAppStore.getState().permissions["s1"] ?? []
    expect(perms.map((p) => p.id)).toEqual(["req2"])
  })
})

describe("store — questions", () => {
  beforeEach(resetStore)

  test("upsertQuestion adds question to session", () => {
    const req = makeQuestion("q1", "s1")
    useAppStore.getState().upsertQuestion(req)
    expect(useAppStore.getState().questions["s1"]).toHaveLength(1)
  })

  test("removeQuestion removes the correct question", () => {
    useAppStore.getState().upsertQuestion(makeQuestion("q1", "s1"))
    useAppStore.getState().upsertQuestion(makeQuestion("q2", "s1"))
    useAppStore.getState().removeQuestion("s1", "q1")
    const qs = useAppStore.getState().questions["s1"] ?? []
    expect(qs.map((q) => q.id)).toEqual(["q2"])
  })
})

describe("store — dialogs", () => {
  beforeEach(resetStore)

  test("pushDialog adds dialog to the stack", () => {
    useAppStore.getState().pushDialog({ type: "command-palette" })
    expect(useAppStore.getState().dialogs).toHaveLength(1)
    expect(useAppStore.getState().dialogs[0]!.type).toBe("command-palette")
  })

  test("pushDialog supports multiple dialogs (stack)", () => {
    useAppStore.getState().pushDialog({ type: "command-palette" })
    useAppStore.getState().pushDialog({ type: "help" })
    expect(useAppStore.getState().dialogs).toHaveLength(2)
    expect(useAppStore.getState().dialogs[1]!.type).toBe("help")
  })

  test("popDialog removes the top dialog", () => {
    useAppStore.getState().pushDialog({ type: "command-palette" })
    useAppStore.getState().pushDialog({ type: "help" })
    useAppStore.getState().popDialog()
    const { dialogs } = useAppStore.getState()
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]!.type).toBe("command-palette")
  })

  test("popDialog on empty stack is a no-op", () => {
    useAppStore.getState().popDialog()
    expect(useAppStore.getState().dialogs).toHaveLength(0)
  })
})

describe("store — navigation", () => {
  beforeEach(resetStore)

  test("navigate to home", () => {
    useAppStore.getState().navigate({ type: "home" })
    expect(useAppStore.getState().route.type).toBe("home")
  })

  test("navigate to session", () => {
    useAppStore.getState().navigate({ type: "session", sessionID: "sess-123" })
    const route = useAppStore.getState().route
    expect(route.type).toBe("session")
    if (route.type === "session") expect(route.sessionID).toBe("sess-123")
  })

  test("navigate to plugin", () => {
    useAppStore.getState().navigate({ type: "plugin", name: "my-plugin" })
    const route = useAppStore.getState().route
    expect(route.type).toBe("plugin")
    if (route.type === "plugin") expect(route.name).toBe("my-plugin")
  })
})

describe("store — toasts", () => {
  beforeEach(resetStore)

  test("addToast adds a toast with unique ID", () => {
    useAppStore.getState().addToast({ message: "Hello", variant: "info", duration: 1000 })
    const { toasts } = useAppStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe("Hello")
    expect(typeof toasts[0]!.id).toBe("string")
  })

  test("removeToast removes by ID", () => {
    useAppStore.getState().addToast({ message: "A", variant: "info", duration: 10000 })
    useAppStore.getState().addToast({ message: "B", variant: "success", duration: 10000 })
    const id = useAppStore.getState().toasts[0]!.id
    useAppStore.getState().removeToast(id)
    const { toasts } = useAppStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe("B")
  })
})

describe("store — prompt history", () => {
  beforeEach(resetStore)

  test("pushPromptHistory adds entry", () => {
    useAppStore.getState().pushPromptHistory("hello world")
    expect(useAppStore.getState().promptHistory[0]).toBe("hello world")
  })

  test("pushPromptHistory deduplicates (moves to front)", () => {
    useAppStore.getState().pushPromptHistory("a")
    useAppStore.getState().pushPromptHistory("b")
    useAppStore.getState().pushPromptHistory("a")
    const hist = useAppStore.getState().promptHistory
    expect(hist[0]).toBe("a")
    expect(hist[1]).toBe("b")
    expect(hist).toHaveLength(2)
  })

  test("setPromptStash sets and clears stash", () => {
    useAppStore.getState().setPromptStash("stashed text")
    expect(useAppStore.getState().promptStash).toBe("stashed text")
    useAppStore.getState().setPromptStash(null)
    expect(useAppStore.getState().promptStash).toBeNull()
  })
})

describe("store — model / agent selection", () => {
  beforeEach(resetStore)

  test("setCurrentModel sets model and tracks recent", () => {
    useAppStore.getState().setCurrentModel({ providerID: "anthropic", modelID: "claude-3-5" })
    const state = useAppStore.getState()
    expect(state.currentModel?.modelID).toBe("claude-3-5")
    expect(state.recentModels).toHaveLength(1)
  })

  test("setCurrentModel deduplicates recent models", () => {
    useAppStore.getState().setCurrentModel({ providerID: "anthropic", modelID: "model-a" })
    useAppStore.getState().setCurrentModel({ providerID: "anthropic", modelID: "model-b" })
    useAppStore.getState().setCurrentModel({ providerID: "anthropic", modelID: "model-a" })
    const { recentModels } = useAppStore.getState()
    expect(recentModels.map((m) => m.modelID)).toEqual(["model-a", "model-b"])
  })

  test("setCurrentAgent sets agent", () => {
    useAppStore.getState().setCurrentAgent("coder")
    expect(useAppStore.getState().currentAgent).toBe("coder")
  })

  test("setCurrentAgent clears agent with undefined", () => {
    useAppStore.getState().setCurrentAgent("coder")
    useAppStore.getState().setCurrentAgent(undefined)
    expect(useAppStore.getState().currentAgent).toBeUndefined()
  })

  test("sendPrompt falls back to the active agent when no agent is selected", async () => {
    const calls: Array<{ agent?: string; model?: { providerID: string; modelID: string } }> = []
    useAppStore.setState({
      client: {
        session: {
          promptAsync: async (input: { agent?: string; model?: { providerID: string; modelID: string } }) => {
            calls.push(input)
          },
        },
      } as never,
      mode: "plan",
      currentModel: { providerID: "anthropic", modelID: "claude-3-5" },
      currentAgent: undefined,
    })

    await useAppStore.getState().sendPrompt("s1", "hello")

    expect(calls).toHaveLength(1)
    expect(calls[0]?.agent).toBe("plan")
    expect(calls[0]?.model).toEqual({ providerID: "anthropic", modelID: "claude-3-5" })
  })

  test("sendPrompt keeps a picked agent over the active agent", async () => {
    const calls: Array<{ agent?: string }> = []
    useAppStore.setState({
      client: {
        session: {
          promptAsync: async (input: { agent?: string }) => {
            calls.push(input)
          },
        },
      } as never,
      mode: "build",
      currentAgent: "review",
      providerConnected: ["anthropic"],
    })

    await useAppStore.getState().sendPrompt("s1", "hello")

    expect(calls).toHaveLength(1)
    expect(calls[0]?.agent).toBe("review")
  })

  test("sendPrompt routes matching OpenCode slash commands through session.command", async () => {
    const prompt: unknown[] = []
    const cmd: Array<{
      sessionID: string
      command: string
      arguments: string
      model?: string
      agent?: string
      parts?: unknown[]
    }> = []

    useAppStore.setState({
      client: {
        session: {
          promptAsync: async (input: unknown) => {
            prompt.push(input)
          },
          command: async (input: {
            sessionID: string
            command: string
            arguments: string
            model?: string
            agent?: string
            parts?: unknown[]
          }) => {
            cmd.push(input)
          },
        },
      } as never,
      commands: [{ name: "review", template: "", hints: [] }] as never,
      mode: "build",
      currentAgent: "reviewer",
      currentModel: { providerID: "anthropic", modelID: "claude-3-5" },
    })

    await useAppStore.getState().sendPrompt("s1", "/review diff head\ninclude tests", [
      {
        type: "file",
        filename: "foo.ts",
        mime: "text/plain",
        url: "file:///tmp/foo.ts",
      },
    ])

    expect(prompt).toHaveLength(0)
    expect(cmd).toEqual([
      {
        sessionID: "s1",
        command: "review",
        arguments: "diff head\ninclude tests",
        model: "anthropic/claude-3-5",
        agent: "reviewer",
        parts: [
          {
            type: "file",
            filename: "foo.ts",
            mime: "text/plain",
            url: "file:///tmp/foo.ts",
          },
        ],
      },
    ])
  })

  test("sendPrompt routes matching local slash commands through the registry", async () => {
    let seen = 0
    const prompt: unknown[] = []
    const cmd: unknown[] = []
    const off = registry.register({
      id: "test.thinking",
      label: "Toggle Reasoning",
      category: "Test",
      slash: "thinking",
      action: () => {
        seen += 1
      },
    })

    useAppStore.setState({
      client: {
        session: {
          promptAsync: async (input: unknown) => {
            prompt.push(input)
          },
          command: async (input: unknown) => {
            cmd.push(input)
          },
        },
      } as never,
    })

    try {
      await useAppStore.getState().sendPrompt("s1", "/thinking")
    } finally {
      off()
    }

    expect(seen).toBe(1)
    expect(prompt).toHaveLength(0)
    expect(cmd).toHaveLength(0)
    expect(useAppStore.getState().composerStatus).toBe("idle")
  })

  test("sendPrompt shows a warning toast for unknown slash commands", async () => {
    const prompt: unknown[] = []

    useAppStore.setState({
      client: {
        session: {
          promptAsync: async (input: unknown) => {
            prompt.push(input)
          },
        },
      } as never,
      commands: [],
    })

    await useAppStore.getState().sendPrompt("s1", "/missing")

    expect(prompt).toHaveLength(0)
    expect(useAppStore.getState().toasts.at(-1)?.title).toBe("Unknown command")
  })

  test("loadMessageDiff stores scoped diffs per assistant message", async () => {
    useAppStore.setState({
      client: {
        session: {
          diff: async () => ({
            data: [
              {
                file: "src/app.ts",
                patch: "@@ -1 +1 @@\n-old\n+new",
                additions: 1,
                deletions: 1,
                status: "modified",
              },
            ],
          }),
        },
      } as never,
    })

    await useAppStore.getState().loadMessageDiff("s1", "m-assistant", "m-user")

    expect(useAppStore.getState().messageDiff["m-assistant"]?.[0]?.file).toBe("src/app.ts")
    expect(useAppStore.getState().messageDiffLoaded["m-assistant"]).toBe(true)
  })

  test("revertSession reverts the latest user message and aborts busy sessions first", async () => {
    const abort: Array<{ sessionID: string }> = []
    const revert: Array<{ sessionID: string; messageID: string }> = []

    useAppStore.setState({
      client: {
        session: {
          abort: async (input: { sessionID: string }) => {
            abort.push(input)
          },
          revert: async (input: { sessionID: string; messageID: string }) => {
            revert.push(input)
          },
        },
      } as never,
      sessionStatus: { s1: { type: "busy" } as never },
      messages: {
        s1: [
          { id: "m1", sessionID: "s1", role: "user" } as never,
          { id: "m2", sessionID: "s1", role: "assistant" } as never,
          { id: "m3", sessionID: "s1", role: "user" } as never,
        ],
      },
    })

    await useAppStore.getState().revertSession("s1")

    expect(abort).toEqual([{ sessionID: "s1" }])
    expect(revert).toEqual([{ sessionID: "s1", messageID: "m3" }])
  })
})

describe("store — theme", () => {
  beforeEach(resetStore)

  test("setTheme updates currentThemeName", () => {
    useAppStore.getState().setTheme("nord")
    expect(useAppStore.getState().currentThemeName).toBe("nord")
  })
})

describe("store — scroll position", () => {
  beforeEach(resetStore)

  test("setScrollPos stores position per session", () => {
    useAppStore.getState().setScrollPos("s1", 5)
    useAppStore.getState().setScrollPos("s2", 10)
    expect(useAppStore.getState().scrollPos["s1"]).toBe(5)
    expect(useAppStore.getState().scrollPos["s2"]).toBe(10)
  })

  test("setLastSeen stores a detach marker per session", () => {
    useAppStore.getState().setLastSeen("s1", 3)
    useAppStore.getState().setLastSeen("s2", 7)
    expect(useAppStore.getState().lastSeen["s1"]).toBe(3)
    expect(useAppStore.getState().lastSeen["s2"]).toBe(7)
  })

  test("setMessageCursor stores a per-session message pointer", () => {
    useAppStore.getState().setMessageCursor("s1", 2)
    useAppStore.getState().setMessageCursor("s2", null)
    expect(useAppStore.getState().messageCursor["s1"]).toBe(2)
    expect(useAppStore.getState().messageCursor["s2"]).toBeNull()
  })

  test("seedComposer primes a replaceable composer draft", () => {
    useAppStore.getState().seedComposer("retry this prompt")
    expect(useAppStore.getState().composerSeed?.text).toBe("retry this prompt")
    useAppStore.getState().clearComposerSeed()
    expect(useAppStore.getState().composerSeed).toBeNull()
  })
})
