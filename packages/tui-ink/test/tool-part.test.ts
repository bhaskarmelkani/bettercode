/**
 * Tests for ToolPart pure helpers.
 * isOpen encodes the tool disclosure defaults:
 *   - All non-error tools start collapsed (collapsed = undefined → false).
 *   - Error tools auto-expand (collapsed = undefined → true).
 *   - User can explicitly expand (collapsed = false) or collapse (collapsed = true) any tool.
 */
import { describe, test, expect, beforeEach } from "bun:test"
import { isOpen } from "../src/components/parts/ToolPart"
import { useAppStore } from "../src/store"

// ---------------------------------------------------------------------------
// isOpen — pure disclosure logic
// ---------------------------------------------------------------------------

describe("isOpen — default disclosure", () => {
  test("pending tool defaults closed", () => {
    expect(isOpen("pending", undefined)).toBe(false)
  })

  test("running tool defaults closed", () => {
    expect(isOpen("running", undefined)).toBe(false)
  })

  test("completed tool defaults closed", () => {
    expect(isOpen("completed", undefined)).toBe(false)
  })

  test("error tool auto-expands by default", () => {
    expect(isOpen("error", undefined)).toBe(true)
  })
})

describe("isOpen — explicit user toggle", () => {
  test("collapsed=false opens any status", () => {
    expect(isOpen("pending", false)).toBe(true)
    expect(isOpen("running", false)).toBe(true)
    expect(isOpen("completed", false)).toBe(true)
    expect(isOpen("error", false)).toBe(true)
  })

  test("collapsed=true closes any status including error", () => {
    expect(isOpen("pending", true)).toBe(false)
    expect(isOpen("running", true)).toBe(false)
    expect(isOpen("completed", true)).toBe(false)
    expect(isOpen("error", true)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Store toggle semantics for tool collapse
// The store starts tools at undefined (closed by default).
// First toggle → false (expanded). Second toggle → true (collapsed).
// ---------------------------------------------------------------------------

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

function makeTool(id: string, messageID: string) {
  return {
    id,
    messageID,
    sessionID: "s1",
    type: "tool",
    callID: `call-${id}`,
    tool: "Bash",
    state: {
      status: "completed",
      input: { command: "ls" },
      output: "file.ts",
      title: "ls",
      metadata: {},
      time: { start: 1, end: 2 },
    },
  } as any
}

describe("store collapse state — tool lifecycle", () => {
  beforeEach(resetStore)

  test("new tool starts with undefined collapse state (uses default closed)", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    expect(useAppStore.getState().collapsedTools["t1"]).toBeUndefined()
    // isOpen confirms this renders as closed
    expect(isOpen("completed", undefined)).toBe(false)
  })

  test("first toggle expands the tool (collapsed=false)", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
    expect(isOpen("completed", false)).toBe(true)
  })

  test("second toggle collapses the tool (collapsed=true)", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().toggleToolCollapse("t1")
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(true)
    expect(isOpen("completed", true)).toBe(false)
  })

  test("third toggle restores expanded (collapsed=false)", () => {
    useAppStore.getState().upsertPart(makeTool("t1", "m1"))
    useAppStore.getState().toggleToolCollapse("t1")
    useAppStore.getState().toggleToolCollapse("t1")
    useAppStore.getState().toggleToolCollapse("t1")
    expect(useAppStore.getState().collapsedTools["t1"]).toBe(false)
  })

  test("error tool auto-expands without any toggle", () => {
    // The store state is still undefined (no toggle needed).
    // isOpen determines expansion based on status.
    expect(isOpen("error", undefined)).toBe(true)
  })

  test("user can explicitly collapse an error tool", () => {
    useAppStore.getState().upsertPart(makeTool("t-err", "m1"))
    useAppStore.getState().toggleToolCollapse("t-err")
    // First toggle from undefined → false (expanded — same as default for errors)
    expect(useAppStore.getState().collapsedTools["t-err"]).toBe(false)
    useAppStore.getState().toggleToolCollapse("t-err")
    // Second toggle → true (explicitly collapsed — overrides auto-expand)
    expect(useAppStore.getState().collapsedTools["t-err"]).toBe(true)
    expect(isOpen("error", true)).toBe(false)
  })

  test("running-to-completed transition: stays collapsed without toggle", () => {
    // Running tool arrives, no toggle yet → undefined.
    expect(isOpen("running", undefined)).toBe(false)
    // Tool completes — still undefined in store, still closed.
    expect(isOpen("completed", undefined)).toBe(false)
  })
})
