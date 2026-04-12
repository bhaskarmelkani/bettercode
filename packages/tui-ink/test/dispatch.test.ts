/**
 * Event dispatch tests.
 * Tests that SDK events are correctly mapped to store mutations.
 * We re-implement the dispatch logic inline here so we can test it
 * without starting the SSE stream.
 */
import { describe, test, expect, beforeEach } from "bun:test"
import { useAppStore } from "../src/store"
import type { Event } from "@opencode-ai/sdk/v2"

// Replicate the dispatch function from useSDK so we can exercise it in unit tests.
// We import the store directly and call the same methods the real dispatch calls.
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
      if (e.properties.part.type !== "text") break
      store.setComposerStatus("generating")
      break

    case "message.part.removed":
      store.removePart(e.properties.messageID, e.properties.partID)
      break

    case "message.part.delta":
      store.appendPartDelta(e.properties.messageID, e.properties.partID, e.properties.field, e.properties.delta)
      if (e.properties.field === "text") store.setComposerStatus("generating")
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
      useAppStore.getState().addToast({
        title: e.properties.title,
        message: e.properties.message,
        variant: e.properties.variant,
        duration: e.properties.duration ?? 4000,
      })
      break

    case "tui.prompt.append":
      useAppStore.getState().setComposerAppend(e.properties.text)
      break

    case "tui.session.select":
      useAppStore.setState({ currentSessionID: e.properties.sessionID })
      useAppStore.getState().navigate({ type: "session", sessionID: e.properties.sessionID })
      break

    case "server.instance.disposed":
      useAppStore.setState({ syncStatus: "loading" })
      break
  }
}

function resetStore() {
  useAppStore.setState({
    client: null,
    syncStatus: "loading",
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
    currentSessionID: "",
  })
}

describe("dispatch — session events", () => {
  beforeEach(resetStore)

  test("session.created adds session", () => {
    dispatch({
      type: "session.created",
      properties: { info: { id: "sess1", title: "Test" } as any },
    } as any)
    expect(useAppStore.getState().sessions.map((s) => s.id)).toContain("sess1")
  })

  test("session.updated replaces session", () => {
    dispatch({
      type: "session.created",
      properties: { info: { id: "sess1", title: "Old" } as any },
    } as any)
    dispatch({
      type: "session.updated",
      properties: { info: { id: "sess1", title: "New" } as any },
    } as any)
    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.title).toBe("New")
  })

  test("session.deleted removes session", () => {
    dispatch({
      type: "session.created",
      properties: { info: { id: "sess1" } as any },
    } as any)
    dispatch({
      type: "session.deleted",
      properties: { info: { id: "sess1" } as any },
    } as any)
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  test("session.idle resets composerStatus", () => {
    useAppStore.setState({ composerStatus: "generating" })
    dispatch({
      type: "session.idle",
      properties: { sessionID: "sess1" } as any,
    } as any)
    expect(useAppStore.getState().composerStatus).toBe("idle")
    expect(useAppStore.getState().sessionStatus["sess1"]?.type).toBe("idle")
  })

  test("session.error sets composerStatus to error", () => {
    dispatch({
      type: "session.error",
      properties: { sessionID: "sess1", error: "oops" } as any,
    } as any)
    expect(useAppStore.getState().composerStatus).toBe("error")
  })
})

describe("dispatch — message events", () => {
  beforeEach(resetStore)

  test("message.updated adds message", () => {
    dispatch({
      type: "message.updated",
      properties: { info: { id: "msg1", sessionID: "s1", role: "user" } as any },
    } as any)
    expect(useAppStore.getState().messages["s1"]).toHaveLength(1)
  })

  test("message.removed removes message", () => {
    dispatch({
      type: "message.updated",
      properties: { info: { id: "msg1", sessionID: "s1", role: "user" } as any },
    } as any)
    dispatch({
      type: "message.removed",
      properties: { sessionID: "s1", messageID: "msg1" } as any,
    } as any)
    expect(useAppStore.getState().messages["s1"]).toHaveLength(0)
  })
})

describe("dispatch — part events", () => {
  beforeEach(resetStore)

  test("message.part.updated adds part and sets generating for text", () => {
    dispatch({
      type: "message.part.updated",
      properties: {
        part: { id: "p1", messageID: "m1", sessionID: "s1", type: "text", text: "Hello" } as any,
      },
    } as any)
    expect(useAppStore.getState().parts["m1"]).toHaveLength(1)
    expect(useAppStore.getState().composerStatus).toBe("generating")
  })

  test("message.part.updated does not set generating for non-text parts", () => {
    dispatch({
      type: "message.part.updated",
      properties: {
        part: { id: "p1", messageID: "m1", sessionID: "s1", type: "tool" } as any,
      },
    } as any)
    expect(useAppStore.getState().composerStatus).toBe("idle")
  })

  test("message.part.delta appends text and sets generating", () => {
    // First insert the part
    dispatch({
      type: "message.part.updated",
      properties: {
        part: { id: "p1", messageID: "m1", sessionID: "s1", type: "text", text: "" } as any,
      },
    } as any)
    useAppStore.setState({ composerStatus: "idle" })
    dispatch({
      type: "message.part.delta",
      properties: { messageID: "m1", partID: "p1", field: "text", delta: "chunk" } as any,
    } as any)
    const parts = useAppStore.getState().parts["m1"] ?? []
    expect((parts[0] as any).text).toBe("chunk")
    expect(useAppStore.getState().composerStatus).toBe("generating")
  })

  test("message.part.delta on non-text field does not set generating", () => {
    dispatch({
      type: "message.part.updated",
      properties: {
        part: { id: "p1", messageID: "m1", sessionID: "s1", type: "reasoning", text: "" } as any,
      },
    } as any)
    useAppStore.setState({ composerStatus: "idle" })
    dispatch({
      type: "message.part.delta",
      properties: { messageID: "m1", partID: "p1", field: "reasoning", delta: "thinking..." } as any,
    } as any)
    expect(useAppStore.getState().composerStatus).toBe("idle")
  })

  test("message.part.removed removes part", () => {
    dispatch({
      type: "message.part.updated",
      properties: {
        part: { id: "p1", messageID: "m1", sessionID: "s1", type: "text", text: "" } as any,
      },
    } as any)
    dispatch({
      type: "message.part.removed",
      properties: { messageID: "m1", partID: "p1" } as any,
    } as any)
    expect(useAppStore.getState().parts["m1"]).toHaveLength(0)
  })
})

describe("dispatch — permission/question events", () => {
  beforeEach(resetStore)

  test("permission.asked adds permission", () => {
    dispatch({
      type: "permission.asked",
      properties: { id: "req1", sessionID: "s1", title: "Allow?", description: "", command: "" } as any,
    } as any)
    expect(useAppStore.getState().permissions["s1"]).toHaveLength(1)
  })

  test("permission.replied removes permission", () => {
    dispatch({
      type: "permission.asked",
      properties: { id: "req1", sessionID: "s1", title: "Allow?", description: "", command: "" } as any,
    } as any)
    dispatch({
      type: "permission.replied",
      properties: { sessionID: "s1", requestID: "req1", reply: "once" } as any,
    } as any)
    expect(useAppStore.getState().permissions["s1"]).toHaveLength(0)
  })

  test("question.asked adds question", () => {
    dispatch({
      type: "question.asked",
      properties: { id: "q1", sessionID: "s1", title: "Continue?", message: "" } as any,
    } as any)
    expect(useAppStore.getState().questions["s1"]).toHaveLength(1)
  })

  test("question.replied removes question", () => {
    dispatch({
      type: "question.asked",
      properties: { id: "q1", sessionID: "s1", title: "Continue?", message: "" } as any,
    } as any)
    dispatch({
      type: "question.replied",
      properties: { sessionID: "s1", requestID: "q1", answers: [] } as any,
    } as any)
    expect(useAppStore.getState().questions["s1"]).toHaveLength(0)
  })
})

describe("dispatch — UI events", () => {
  beforeEach(resetStore)

  test("vcs.branch.updated sets vcs branch", () => {
    dispatch({
      type: "vcs.branch.updated",
      properties: { branch: "main" } as any,
    } as any)
    expect(useAppStore.getState().vcs?.branch).toBe("main")
  })

  test("tui.toast.show adds toast", () => {
    dispatch({
      type: "tui.toast.show",
      properties: { message: "Done!", variant: "success", duration: 3000 } as any,
    } as any)
    expect(useAppStore.getState().toasts).toHaveLength(1)
    expect(useAppStore.getState().toasts[0]!.message).toBe("Done!")
  })

  test("tui.prompt.append sets composerAppend", () => {
    dispatch({
      type: "tui.prompt.append",
      properties: { text: "appended text" } as any,
    } as any)
    expect(useAppStore.getState().composerAppend).toBe("appended text")
  })

  test("tui.session.select navigates to session", () => {
    dispatch({
      type: "tui.session.select",
      properties: { sessionID: "sess-xyz" } as any,
    } as any)
    const route = useAppStore.getState().route
    expect(route.type).toBe("session")
    if (route.type === "session") expect(route.sessionID).toBe("sess-xyz")
    expect(useAppStore.getState().currentSessionID).toBe("sess-xyz")
  })

  test("server.instance.disposed resets syncStatus to loading", () => {
    useAppStore.setState({ syncStatus: "complete" })
    dispatch({
      type: "server.instance.disposed",
      properties: {} as any,
    } as any)
    expect(useAppStore.getState().syncStatus).toBe("loading")
  })
})
