import React from "react"
import type {
  Message,
  Part,
  PermissionRequest,
  QuestionRequest,
  Session,
  SessionStatus,
} from "@opencode-ai/sdk/v2"
import { ThemeProvider } from "../theme-context"
import { HomeScreen } from "../screens/HomeScreen"
import { SessionScreen } from "../screens/SessionScreen"
import { useAppStore } from "../store"

export type Scenario = {
  name: string
  columns: number
  rows: number
  render: () => React.ReactNode
}

const SID = "s-001"

function reset() {
  useAppStore.setState({
    client: null,
    syncStatus: "complete",
    serverUrl: "http://localhost:4096",
    directory: "/tmp/bettercode",
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
    vcs: { branch: "feat/ui-snapshots" } as unknown as NonNullable<ReturnType<typeof useAppStore.getState>["vcs"]>,
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
    currentModel: { providerID: "openai", modelID: "gpt-5.4" },
    currentAgent: undefined,
    recentModels: [{ providerID: "openai", modelID: "gpt-5.4" }],
    showThinking: false,
    mode: "build",
    currentThemeName: "catppuccin-mocha",
    toasts: [],
    composerAppend: "",
    composerLines: 1,
    promptHistory: [],
    promptStash: "Draft: keep the dock compact on 80x24",
    frecency: {},
    route: { type: "home" },
    dialogs: [],
  })
}

function sess(id: string, title: string): Session {
  return {
    id,
    title,
  } as unknown as Session
}

function user(id: string, sid = SID): Message {
  return {
    id,
    role: "user",
    sessionID: sid,
  } as unknown as Message
}

function assistant(id: string, sid = SID, done = true): Message {
  return {
    id,
    role: "assistant",
    sessionID: sid,
    mode: "build",
    modelID: "gpt-5.4",
    finish: done ? "stop" : "tool-calls",
    time: done ? { created: 1_000, completed: 2_450 } : { created: 3_000 },
    tokens: { input: 1820, output: 640 },
  } as unknown as Message
}

function text(id: string, msg: string, body: string, sid = SID): Part {
  return {
    id,
    type: "text",
    messageID: msg,
    sessionID: sid,
    text: body,
  } as unknown as Part
}

function tool(id: string, msg: string, sid = SID): Part {
  return {
    id,
    type: "tool",
    messageID: msg,
    sessionID: sid,
    tool: "bash",
    state: {
      status: "completed",
      title: "audit transcript rendering",
      input: { command: "rg -n \"render|scroll\" packages/tui-ink/src" },
      output:
        "packages/tui-ink/src/components/MessageList.tsx\npackages/tui-ink/src/components/Composer.tsx\npackages/tui-ink/src/screens/SessionScreen.tsx",
      time: { start: 1_300, end: 1_720 },
    },
  } as unknown as Part
}

function perm(id: string, sid = SID): PermissionRequest {
  return {
    id,
    sessionID: sid,
    permission: "Allow editing files in packages/tui-ink?",
    patterns: ["packages/tui-ink/src/**", "packages/tui-ink/test/**"],
  } as unknown as PermissionRequest
}

function question(id: string, sid = SID): QuestionRequest {
  return {
    id,
    sessionID: sid,
    questions: [
      {
        question: "Which snapshot should we inspect first?",
        options: [
          { label: "home", description: "check startup hierarchy and dock spacing" },
          { label: "session", description: "inspect transcript balance and tool density" },
          { label: "prompts", description: "verify permission and question flows" },
        ],
        custom: true,
      },
    ],
  } as unknown as QuestionRequest
}

function home(columns: number, rows: number): Scenario {
  return {
    name: `home-${columns}x${rows}`,
    columns,
    rows,
    render() {
      reset()
      useAppStore.setState({
        route: { type: "home" },
        directory: "/work/bettercode",
        providers: [{ id: "openai" }, { id: "anthropic" }] as unknown as ReturnType<typeof useAppStore.getState>["providers"],
        sessions: [
          sess("s-099", "Refine dock prompts"),
          sess("s-100", "Tighten transcript hierarchy"),
          sess("s-101", "Build snapshot harness"),
        ],
      })

      return (
        <ThemeProvider>
          <HomeScreen rows={rows} columns={columns} active={true} />
        </ThemeProvider>
      )
    },
  }
}

function session(columns: number, rows: number): Scenario {
  return {
    name: `session-mixed-${columns}x${rows}`,
    columns,
    rows,
    render() {
      reset()
      const u1 = user("m-001")
      const a1 = assistant("m-002")
      const u2 = user("m-003")
      const a2 = assistant("m-004")
      useAppStore.setState({
        route: { type: "session", sessionID: SID },
        currentSessionID: SID,
        directory: "/work/bettercode",
        sessions: [sess(SID, "Snapshot review"), sess("s-002", "Composer follow-up")],
        sessionStatus: { [SID]: { type: "idle" } as SessionStatus },
        messagesLoaded: { [SID]: true },
        messages: {
          [SID]: [u1, a1, u2, a2],
        },
        parts: {
          "m-001": [
            text(
              "p-001",
              "m-001",
              "Can we make the TUI snapshot-friendly so agents can inspect spacing, hierarchy, and prompts?",
            ),
          ],
          "m-002": [
            text(
              "p-002",
              "m-002",
              "Yes. We can render deterministic Ink frames and save them as review artifacts.\n\n- capture `80x24` and `120x40`\n- seed transcript fixtures\n- diff plain-text snapshots in CI",
            ),
            tool("t-002", "m-002"),
          ],
          "m-003": [
            text("p-003", "m-003", "Great. Start with representative screens before we add deeper PTY interaction tests."),
          ],
          "m-004": [
            text(
              "p-004",
              "m-004",
              "This first pass focuses on static frames that expose the main visual structure: header, transcript, dock, prompts, and status lane.",
            ),
          ],
        },
      })

      return (
        <ThemeProvider>
          <SessionScreen sessionID={SID} rows={rows} columns={columns} active={true} />
        </ThemeProvider>
      )
    },
  }
}

function permission(columns: number, rows: number): Scenario {
  return {
    name: `session-permission-${columns}x${rows}`,
    columns,
    rows,
    render() {
      reset()
      const u1 = user("m-011")
      const a1 = assistant("m-012")
      useAppStore.setState({
        route: { type: "session", sessionID: SID },
        currentSessionID: SID,
        sessions: [sess(SID, "Permission flow")],
        messagesLoaded: { [SID]: true },
        sessionStatus: { [SID]: { type: "idle" } as SessionStatus },
        messages: { [SID]: [u1, a1] },
        parts: {
          "m-011": [text("p-011", "m-011", "Please update the snapshot harness and save the results.")],
          "m-012": [text("p-012", "m-012", "I need permission before writing new test artifacts.")],
        },
        permissions: { [SID]: [perm("perm-001")] },
      })

      return (
        <ThemeProvider>
          <SessionScreen sessionID={SID} rows={rows} columns={columns} active={true} />
        </ThemeProvider>
      )
    },
  }
}

function prompt(columns: number, rows: number): Scenario {
  return {
    name: `session-question-${columns}x${rows}`,
    columns,
    rows,
    render() {
      reset()
      const u1 = user("m-021")
      const a1 = assistant("m-022")
      useAppStore.setState({
        route: { type: "session", sessionID: SID },
        currentSessionID: SID,
        sessions: [sess(SID, "Question flow")],
        messagesLoaded: { [SID]: true },
        sessionStatus: { [SID]: { type: "idle" } as SessionStatus },
        messages: { [SID]: [u1, a1] },
        parts: {
          "m-021": [text("p-021", "m-021", "Which snapshot should we inspect first?")],
          "m-022": [text("p-022", "m-022", "Choose the surface that best reflects the current UI risk.")],
        },
        questions: { [SID]: [question("question-001")] },
      })

      return (
        <ThemeProvider>
          <SessionScreen sessionID={SID} rows={rows} columns={columns} active={true} />
        </ThemeProvider>
      )
    },
  }
}

export const scenarios: Scenario[] = [
  home(80, 24),
  home(120, 40),
  session(80, 24),
  session(120, 40),
  permission(80, 24),
  prompt(80, 24),
]
