/**
 * Integration tests — simulate the full SSE event pipeline.
 *
 * These tests exercise the same dispatch path that useSDK uses in production:
 * events arrive, dispatch() is called, and we assert the final store state.
 * No real server or browser is required.
 *
 * Pattern:
 *   1. Reset the store.
 *   2. Fire a sequence of events (as the server would emit them).
 *   3. Assert the store reflects the correct final state.
 */
import { describe, test, expect, beforeEach } from "bun:test"
import { useAppStore } from "../src/store"
import type { Event } from "@opencode-ai/sdk/v2"

// ---------------------------------------------------------------------------
// Re-implement the dispatch logic inline so we can test it in isolation.
// This mirrors the real dispatch function in useSDK.ts, including the same
// delta-batching behaviour (we skip batching here and call appendPartDelta
// directly to keep tests synchronous).
// ---------------------------------------------------------------------------
function dispatch(e: Event) {
  const store = useAppStore.getState()

  switch (e.type) {
    case "session.created":
    case "session.updated":
      store.upsertSession(e.properties.info)
      break
    case "session.deleted":
      store.removeSession(e.properties.info.id)
      break
    case "session.status":
      store.setSessionStatus(e.properties.sessionID, e.properties.status)
      break
    case "session.idle":
      store.setSessionStatus(e.properties.sessionID, { type: "idle" })
      store.setComposerStatus("idle")
      break
    case "session.error":
      store.setComposerStatus("error")
      break
    case "session.diff":
      store.setSessionDiff(e.properties.sessionID, e.properties.diff)
      break
    case "message.updated":
      store.upsertMessage(e.properties.info)
      break
    case "message.removed":
      store.removeMessage(e.properties.sessionID, e.properties.messageID)
      break
    case "message.part.updated":
      store.upsertPart(e.properties.part)
      break
    case "message.part.removed":
      store.removePart(e.properties.messageID, e.properties.partID)
      break
    case "message.part.delta":
      // Bypass batching in tests — apply immediately for synchronous assertions.
      store.appendPartDelta(e.properties.messageID, e.properties.partID, e.properties.field, e.properties.delta)
      break
    case "permission.asked":
      store.upsertPermission(e.properties)
      break
    case "permission.replied":
      store.removePermission(e.properties.sessionID, e.properties.requestID)
      break
    case "question.asked":
      store.upsertQuestion(e.properties)
      break
    case "question.replied":
    case "question.rejected":
      store.removeQuestion(e.properties.sessionID, e.properties.requestID)
      break
    case "vcs.branch.updated":
      useAppStore.setState({ vcs: { branch: e.properties.branch } })
      break
    case "tui.toast.show":
      store.addToast({
        title: e.properties.title,
        message: e.properties.message,
        variant: e.properties.variant,
        duration: e.properties.duration ?? 4000,
      })
      break
    case "tui.prompt.append":
      store.setComposerAppend(e.properties.text)
      break
    case "tui.session.select":
      useAppStore.setState({ currentSessionID: e.properties.sessionID })
      store.navigate({ type: "session", sessionID: e.properties.sessionID })
      break
    case "server.instance.disposed":
      useAppStore.setState({ syncStatus: "loading" })
      break
  }
}

function resetStore() {
  useAppStore.setState({
    client: null,
    syncStatus: "complete",
    serverUrl: "http://localhost:4096",
    directory: "/project",
    serverHeaders: undefined,
    currentSessionID: "",
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
    dialogs: [],
    route: { type: "home" },
    toasts: [],
    promptHistory: [],
    promptStash: null,
    frecency: {},
    providers: [],
    agents: [],
    commands: [],
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
  })
}

// ---------------------------------------------------------------------------
// Scenario 1: Full session + message streaming lifecycle
// ---------------------------------------------------------------------------
describe("integration: streaming session lifecycle", () => {
  beforeEach(resetStore)

  test("session created → message streamed → session idle", () => {
    const SID = "session-001"
    const MID = "msg-001"
    const PID = "part-001"

    // 1. Session is created
    dispatch({
      type: "session.created",
      properties: { info: { id: SID, title: "Test session" } as any },
    } as any)
    expect(useAppStore.getState().sessions.map((s) => s.id)).toContain(SID)

    // 2. Session becomes busy
    dispatch({
      type: "session.status",
      properties: { sessionID: SID, status: { type: "busy" } } as any,
    } as any)
    expect(useAppStore.getState().sessionStatus[SID]?.type).toBe("busy")

    // 3. User message is created
    dispatch({
      type: "message.updated",
      properties: { info: { id: "user-msg-001", sessionID: SID, role: "user" } as any },
    } as any)

    // 4. Assistant message skeleton created
    dispatch({
      type: "message.updated",
      properties: { info: { id: MID, sessionID: SID, role: "assistant" } as any },
    } as any)
    expect(useAppStore.getState().messages[SID]?.map((m) => m.id)).toContain(MID)

    // 5. Text part skeleton
    dispatch({
      type: "message.part.updated",
      properties: { part: { id: PID, messageID: MID, sessionID: SID, type: "text", text: "" } as any },
    } as any)
    expect(useAppStore.getState().parts[MID]).toHaveLength(1)

    // 6. Streaming deltas arrive
    const chunks = ["Hello", ", ", "world", "!"]
    for (const chunk of chunks) {
      dispatch({
        type: "message.part.delta",
        properties: { messageID: MID, partID: PID, field: "text", delta: chunk } as any,
      } as any)
    }
    const finalText = (useAppStore.getState().parts[MID]?.[0] as any)?.text
    expect(finalText).toBe("Hello, world!")

    // 7. Session goes idle
    dispatch({
      type: "session.idle",
      properties: { sessionID: SID } as any,
    } as any)
    expect(useAppStore.getState().sessionStatus[SID]?.type).toBe("idle")
    expect(useAppStore.getState().composerStatus).toBe("idle")
  })

  test("session error marks composerStatus as error", () => {
    const SID = "session-err"
    dispatch({
      type: "session.created",
      properties: { info: { id: SID } as any },
    } as any)
    dispatch({
      type: "session.error",
      properties: { sessionID: SID, error: "Rate limit exceeded" } as any,
    } as any)
    expect(useAppStore.getState().composerStatus).toBe("error")
  })

  test("multiple sessions stream independently", () => {
    const S1 = "session-A"
    const S2 = "session-B"

    // Create both sessions
    for (const sid of [S1, S2]) {
      dispatch({ type: "session.created", properties: { info: { id: sid } as any } } as any)
      dispatch({ type: "message.updated", properties: { info: { id: `msg-${sid}`, sessionID: sid, role: "assistant" } as any } } as any)
      dispatch({ type: "message.part.updated", properties: { part: { id: `p-${sid}`, messageID: `msg-${sid}`, sessionID: sid, type: "text", text: "" } as any } } as any)
    }

    // Stream different content to each
    dispatch({ type: "message.part.delta", properties: { messageID: `msg-${S1}`, partID: `p-${S1}`, field: "text", delta: "Session A text" } as any } as any)
    dispatch({ type: "message.part.delta", properties: { messageID: `msg-${S2}`, partID: `p-${S2}`, field: "text", delta: "Session B text" } as any } as any)

    const textA = (useAppStore.getState().parts[`msg-${S1}`]?.[0] as any)?.text
    const textB = (useAppStore.getState().parts[`msg-${S2}`]?.[0] as any)?.text
    expect(textA).toBe("Session A text")
    expect(textB).toBe("Session B text")
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Tool call sequence
// ---------------------------------------------------------------------------
describe("integration: tool call lifecycle", () => {
  beforeEach(resetStore)

  test("tool runs then completes", () => {
    const SID = "session-tool"
    const MID = "msg-tool"
    const TOOL_ID = "tool-001"

    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: MID, sessionID: SID, role: "assistant" } as any } } as any)

    // Tool starts as pending
    dispatch({
      type: "message.part.updated",
      properties: {
        part: {
          id: TOOL_ID,
          messageID: MID,
          sessionID: SID,
          type: "tool",
          tool: "Bash",
          state: { status: "pending", input: { command: "ls" } },
        } as any,
      },
    } as any)

    let toolPart = useAppStore.getState().parts[MID]?.[0] as any
    expect(toolPart?.state?.status).toBe("pending")

    // Tool moves to running
    dispatch({
      type: "message.part.updated",
      properties: {
        part: {
          id: TOOL_ID,
          messageID: MID,
          sessionID: SID,
          type: "tool",
          tool: "Bash",
          state: { status: "running", input: { command: "ls" }, title: "Running ls" },
        } as any,
      },
    } as any)
    toolPart = useAppStore.getState().parts[MID]?.[0] as any
    expect(toolPart?.state?.status).toBe("running")

    // Tool completes
    dispatch({
      type: "message.part.updated",
      properties: {
        part: {
          id: TOOL_ID,
          messageID: MID,
          sessionID: SID,
          type: "tool",
          tool: "Bash",
          state: { status: "completed", input: { command: "ls" }, title: "ls", output: "file1.ts\nfile2.ts" },
        } as any,
      },
    } as any)
    toolPart = useAppStore.getState().parts[MID]?.[0] as any
    expect(toolPart?.state?.status).toBe("completed")
    expect(toolPart?.state?.output).toContain("file1.ts")
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Permission prompt lifecycle
// ---------------------------------------------------------------------------
describe("integration: permission and question prompts", () => {
  beforeEach(resetStore)

  test("permission appears then is answered", () => {
    const SID = "session-perm"
    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)

    dispatch({
      type: "permission.asked",
      properties: { id: "perm-1", sessionID: SID, title: "Run command?", description: "ls -la", command: "ls" } as any,
    } as any)
    expect(useAppStore.getState().permissions[SID]).toHaveLength(1)

    dispatch({
      type: "permission.replied",
      properties: { sessionID: SID, requestID: "perm-1", reply: "once" } as any,
    } as any)
    expect(useAppStore.getState().permissions[SID]).toHaveLength(0)
  })

  test("question prompt lifecycle", () => {
    const SID = "session-q"
    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)

    dispatch({
      type: "question.asked",
      properties: { id: "q-1", sessionID: SID, title: "Which approach?", message: "Choose one" } as any,
    } as any)
    expect(useAppStore.getState().questions[SID]).toHaveLength(1)

    dispatch({
      type: "question.replied",
      properties: { sessionID: SID, requestID: "q-1", answers: [["option-a"]] } as any,
    } as any)
    expect(useAppStore.getState().questions[SID]).toHaveLength(0)
  })

  test("rejected question is also removed", () => {
    const SID = "session-q2"
    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({
      type: "question.asked",
      properties: { id: "q-2", sessionID: SID, title: "?", message: "" } as any,
    } as any)
    dispatch({
      type: "question.rejected",
      properties: { sessionID: SID, requestID: "q-2" } as any,
    } as any)
    expect(useAppStore.getState().questions[SID]).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Session management (create, rename, delete, fork)
// ---------------------------------------------------------------------------
describe("integration: session management flow", () => {
  beforeEach(resetStore)

  test("sessions survive create → rename → delete cycle", () => {
    // Create
    dispatch({ type: "session.created", properties: { info: { id: "s1", title: "Untitled" } as any } } as any)
    dispatch({ type: "session.created", properties: { info: { id: "s2", title: "Work" } as any } } as any)
    expect(useAppStore.getState().sessions).toHaveLength(2)

    // Rename s1 via update event
    dispatch({ type: "session.updated", properties: { info: { id: "s1", title: "Renamed" } as any } } as any)
    expect(useAppStore.getState().sessions.find((s) => s.id === "s1")?.title).toBe("Renamed")

    // Delete s2
    dispatch({ type: "session.deleted", properties: { info: { id: "s2" } as any } } as any)
    expect(useAppStore.getState().sessions.map((s) => s.id)).toEqual(["s1"])
  })

  test("message revert: removing messages clears them", () => {
    const SID = "session-revert"
    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: "m1", sessionID: SID, role: "user" } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: "m2", sessionID: SID, role: "assistant" } as any } } as any)
    expect(useAppStore.getState().messages[SID]).toHaveLength(2)

    dispatch({ type: "message.removed", properties: { sessionID: SID, messageID: "m2" } as any } as any)
    expect(useAppStore.getState().messages[SID]).toHaveLength(1)
    expect(useAppStore.getState().messages[SID]?.[0]?.id).toBe("m1")
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: UI event pipeline (toasts, VCS, session select, server dispose)
// ---------------------------------------------------------------------------
describe("integration: UI event pipeline", () => {
  beforeEach(resetStore)

  test("toast lifecycle: show and auto-remove by id", () => {
    dispatch({
      type: "tui.toast.show",
      properties: { message: "Saved!", variant: "success", duration: 100 } as any,
    } as any)
    expect(useAppStore.getState().toasts).toHaveLength(1)
    // Remove it manually (the auto-timeout fires asynchronously)
    const id = useAppStore.getState().toasts[0]!.id
    useAppStore.getState().removeToast(id)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })

  test("multiple toasts stack and are individually removable", () => {
    dispatch({ type: "tui.toast.show", properties: { message: "A", variant: "info", duration: 5000 } as any } as any)
    dispatch({ type: "tui.toast.show", properties: { message: "B", variant: "warning", duration: 5000 } as any } as any)
    dispatch({ type: "tui.toast.show", properties: { message: "C", variant: "error", duration: 5000 } as any } as any)
    expect(useAppStore.getState().toasts).toHaveLength(3)

    const idB = useAppStore.getState().toasts[1]!.id
    useAppStore.getState().removeToast(idB)
    const remaining = useAppStore.getState().toasts.map((t) => t.message)
    expect(remaining).toEqual(["A", "C"])
  })

  test("vcs branch update is reflected in store", () => {
    dispatch({ type: "vcs.branch.updated", properties: { branch: "feature/new-ui" } as any } as any)
    expect(useAppStore.getState().vcs?.branch).toBe("feature/new-ui")

    dispatch({ type: "vcs.branch.updated", properties: { branch: "main" } as any } as any)
    expect(useAppStore.getState().vcs?.branch).toBe("main")
  })

  test("tui.session.select navigates to the session", () => {
    dispatch({ type: "session.created", properties: { info: { id: "jump-session" } as any } } as any)
    dispatch({ type: "tui.session.select", properties: { sessionID: "jump-session" } as any } as any)
    const route = useAppStore.getState().route
    expect(route.type).toBe("session")
    if (route.type === "session") expect(route.sessionID).toBe("jump-session")
    expect(useAppStore.getState().currentSessionID).toBe("jump-session")
  })

  test("server.instance.disposed triggers reconnect by resetting syncStatus", () => {
    useAppStore.setState({ syncStatus: "complete" })
    dispatch({ type: "server.instance.disposed", properties: {} as any } as any)
    expect(useAppStore.getState().syncStatus).toBe("loading")
  })

  test("tui.prompt.append sets composer append text", () => {
    dispatch({ type: "tui.prompt.append", properties: { text: "suggested text" } as any } as any)
    expect(useAppStore.getState().composerAppend).toBe("suggested text")
  })
})

// ---------------------------------------------------------------------------
// Scenario 6: Compaction event
// ---------------------------------------------------------------------------
describe("integration: compaction part", () => {
  beforeEach(resetStore)

  test("compaction part appears in message parts", () => {
    const SID = "session-compact"
    const MID = "msg-compact"

    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: MID, sessionID: SID, role: "assistant" } as any } } as any)
    dispatch({
      type: "message.part.updated",
      properties: { part: { id: "compact-1", messageID: MID, sessionID: SID, type: "compaction" } as any },
    } as any)

    const parts = useAppStore.getState().parts[MID]
    expect(parts).toHaveLength(1)
    expect(parts?.[0]?.type).toBe("compaction")
  })
})

// ---------------------------------------------------------------------------
// Scenario 7: Delta accumulation correctness
// ---------------------------------------------------------------------------
describe("integration: text delta accumulation", () => {
  beforeEach(resetStore)

  test("deltas accumulate in correct order across many chunks", () => {
    const MID = "msg-delta"
    const PID = "part-delta"
    const SID = "session-delta"

    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: MID, sessionID: SID, role: "assistant" } as any } } as any)
    dispatch({ type: "message.part.updated", properties: { part: { id: PID, messageID: MID, sessionID: SID, type: "text", text: "" } as any } } as any)

    const words = ["The", " quick", " brown", " fox", " jumps", " over", " the", " lazy", " dog"]
    for (const w of words) {
      dispatch({ type: "message.part.delta", properties: { messageID: MID, partID: PID, field: "text", delta: w } as any } as any)
    }

    const finalText = (useAppStore.getState().parts[MID]?.[0] as any)?.text
    expect(finalText).toBe("The quick brown fox jumps over the lazy dog")
  })

  test("deltas to different fields accumulate independently", () => {
    const MID = "msg-multi-field"
    const SID = "session-multi"

    dispatch({ type: "session.created", properties: { info: { id: SID } as any } } as any)
    dispatch({ type: "message.updated", properties: { info: { id: MID, sessionID: SID, role: "assistant" } as any } } as any)
    dispatch({ type: "message.part.updated", properties: { part: { id: "p-text", messageID: MID, sessionID: SID, type: "text", text: "" } as any } } as any)
    dispatch({ type: "message.part.updated", properties: { part: { id: "p-reasoning", messageID: MID, sessionID: SID, type: "reasoning", reasoning: "" } as any } } as any)

    dispatch({ type: "message.part.delta", properties: { messageID: MID, partID: "p-text", field: "text", delta: "answer" } as any } as any)
    dispatch({ type: "message.part.delta", properties: { messageID: MID, partID: "p-reasoning", field: "reasoning", delta: "thinking" } as any } as any)

    const textPart = useAppStore.getState().parts[MID]?.find((p) => p.id === "p-text") as any
    const reasoningPart = useAppStore.getState().parts[MID]?.find((p) => p.id === "p-reasoning") as any
    expect(textPart?.text).toBe("answer")
    expect(reasoningPart?.reasoning).toBe("thinking")
  })
})
