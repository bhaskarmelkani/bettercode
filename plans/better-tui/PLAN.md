# bettercode TUI — Implementation Plan

**Audience:** Junior software engineers  
**Goal:** Add a new terminal UI surface (`packages/tui-ink`) to the existing opencode monorepo using Ink (React for the CLI). This does **not** replace the existing TUI — it runs alongside it as a new command `opencode tui-ink`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How It Connects to the Existing System](#how-it-connects-to-the-existing-system)
3. [Milestone 1 — Package Setup](#milestone-1--package-setup)
4. [Milestone 2 — Layout Skeleton](#milestone-2--layout-skeleton)
5. [Milestone 3 — State Management (Zustand)](#milestone-3--state-management-zustand)
6. [Milestone 4 — SDK & Event Stream Integration](#milestone-4--sdk--event-stream-integration)
7. [Milestone 5 — CLI Command Registration](#milestone-5--cli-command-registration)
8. [Milestone 6 — Theming & Keyboard Shortcuts](#milestone-6--theming--keyboard-shortcuts)
9. [Manual QA Testing Guide](#manual-qa-testing-guide)
10. [Definition of Done](#definition-of-done)

---

## Architecture Overview

```
packages/
├── opencode/               ← Core engine (DO NOT MODIFY THE ENGINE)
│   └── src/
│       ├── index.ts        ← CLI entry point  ← YOU ADD ONE IMPORT HERE
│       └── cli/cmd/
│           ├── tui/        ← Existing TUI (OpenTUI + Solid.js)  ← READ BUT DON'T MODIFY
│           └── tui-ink.ts  ← NEW: thin CLI command shim you create
├── sdk/js/                 ← Client SDK (DO NOT MODIFY)
│   └── src/client.ts       ← createOpencodeClient() — you import this
└── tui-ink/               ← NEW PACKAGE YOU BUILD
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.tsx       ← Ink render entry point
        ├── app.tsx         ← Root <App /> component
        ├── store.ts        ← Zustand state store
        ├── theme.ts        ← Color palette constants
        ├── hooks/
        │   └── useSDK.ts   ← SDK client + SSE event wiring
        └── components/
            ├── Header.tsx
            ├── ChatPane.tsx
            ├── ContextPane.tsx
            ├── InputBar.tsx
            └── StatusBar.tsx
```

### Why Ink instead of the existing OpenTUI?

| | Existing TUI | New TUI (this plan) |
|---|---|---|
| Framework | `@opentui/core` + Solid.js (experimental, small community) | Ink + React (battle-tested, used by Vercel CLI, Gatsby, Prisma) |
| Component library | Manual | `@inkjs/ui` (Spinner, TextInput, Select, etc.) |
| State | Solid.js stores | Zustand (small, framework-agnostic) |
| Developer ramp-up | Must learn OpenTUI | Standard React knowledge applies |
| Mouse support | Yes | No (not needed for this surface) |

---

## How It Connects to the Existing System

The opencode server exposes:
- A **REST API** (Hono HTTP) for mutations (send message, create session, etc.)
- A **Server-Sent Events (SSE) stream** at `GET /event` for real-time updates

All surfaces (web app, desktop, existing TUI) connect via the **`@opencode-ai/sdk`** package. Your new TUI does the same:

```
[opencode server]
   │
   ├── SSE stream → useSDK.ts subscribes → Zustand store updates → React re-renders
   └── REST calls ← InputBar submits user message → sdk.client.session.chat(...)
```

The key function is `createOpencodeClient` from `packages/sdk/js/src/client.ts`. Study how the **existing TUI** uses it in:
- `packages/opencode/src/cli/cmd/tui/context/sdk.tsx` — SSE subscription pattern
- `packages/opencode/src/cli/cmd/tui/attach.ts` — server URL + headers setup

---

## Milestone 1 — Package Setup

**Goal:** A new Bun workspace package that renders "Hello from bettercode TUI" without errors.

### Steps

#### 1.1 Create the package directory
```bash
mkdir -p packages/tui-ink/src/components
mkdir -p packages/tui-ink/src/hooks
```

#### 1.2 Create `packages/tui-ink/package.json`
```json
{
  "name": "@opencode-ai/tui-ink",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^5.0.0",
    "react": "^18.3.1",
    "@inkjs/ui": "^2.0.0",
    "zustand": "^5.0.0",
    "@opencode-ai/sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "typescript": "^5.6.0"
  }
}
```

> **Note:** `"workspace:*"` tells Bun to resolve this from the local `packages/sdk/js` workspace — no npm install needed.

#### 1.3 Create `packages/tui-ink/tsconfig.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

#### 1.4 Create `packages/tui-ink/src/index.tsx`
```tsx
import React from "react"
import { render, Text, Box } from "ink"

function App() {
  return (
    <Box>
      <Text color="cyan">Hello from bettercode TUI</Text>
    </Box>
  )
}

render(<App />)
```

#### 1.5 Install dependencies
```bash
# Run from the repo root
bun install
```

### Validation Criteria for M1

Run:
```bash
cd packages/tui-ink
bun run dev
```

**Expected output:**
```
Hello from bettercode TUI
```
- No TypeScript errors
- No "module not found" errors
- Process exits cleanly (no hanging)

**Failure? Check:**
- `bun.lock` was updated (run `bun install` from repo root, not `packages/tui-ink`)
- `tsconfig.json` `jsx` is set to `"react-jsx"` not `"solid-jsx"`
- The `@opencode-ai/sdk` workspace path resolves: run `bun pm ls` and verify it appears

---

## Milestone 2 — Layout Skeleton

**Goal:** A borderless, full-terminal layout with four zones — Header, ChatPane, ContextPane, InputBar — populated with hardcoded dummy data.

### Key Ink Concepts You Need

| Ink concept | What it does |
|---|---|
| `<Box flexDirection="column">` | Vertical stack (like CSS `flex-direction: column`) |
| `<Box flexDirection="row">` | Horizontal split |
| `<Box flexGrow={1}>` | Fills remaining space (like CSS `flex: 1`) |
| `<Box height={1}>` | Fixed height of 1 terminal row |
| `useStdoutDimensions()` | Returns `{ columns, rows }` — total terminal size |
| `<Text wrap="wrap">` | Wraps text at terminal width |
| `<Static>` | Renders items that never change (efficient for chat history) |

### Steps

#### 2.1 Create `packages/tui-ink/src/components/Header.tsx`
```tsx
import React from "react"
import { Box, Text } from "ink"

interface HeaderProps {
  projectName: string
  gitBranch: string
  status: "idle" | "generating" | "error"
}

export function Header({ projectName, gitBranch, status }: HeaderProps) {
  const statusColor = status === "generating" ? "yellow" : status === "error" ? "red" : "green"
  const statusLabel = status === "generating" ? "generating..." : status === "error" ? "error" : "ready"

  return (
    <Box height={1} justifyContent="space-between">
      <Text color="cyan" bold>
        {projectName}
      </Text>
      <Text color="gray"> {gitBranch}</Text>
      <Text color={statusColor}>{statusLabel}</Text>
    </Box>
  )
}
```

#### 2.2 Create `packages/tui-ink/src/components/ChatPane.tsx`
```tsx
import React from "react"
import { Box, Text } from "ink"

interface Message {
  role: "user" | "ai"
  content: string
}

interface ChatPaneProps {
  messages: Message[]
  width: number
  height: number
}

export function ChatPane({ messages, width, height }: ChatPaneProps) {
  return (
    <Box flexDirection="column" width={width} height={height} overflowY="hidden">
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text color={msg.role === "user" ? "cyan" : "white"} bold>
            {msg.role === "user" ? "You" : "AI"}
          </Text>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
      ))}
    </Box>
  )
}
```

> **Note on `overflowY`:** Ink v5 supports `overflowY: "hidden"` on Box. This prevents chat content from overflowing into other zones.

#### 2.3 Create `packages/tui-ink/src/components/ContextPane.tsx`
```tsx
import React from "react"
import { Box, Text } from "ink"

interface ContextPaneProps {
  files: string[]
  width: number
  height: number
}

export function ContextPane({ files, width, height }: ContextPaneProps) {
  return (
    <Box flexDirection="column" width={width} height={height} paddingLeft={1}>
      <Text color="gray" bold>
        Context
      </Text>
      {files.length === 0 ? (
        <Text color="gray" dimColor>
          No files in context
        </Text>
      ) : (
        files.map((f, i) => (
          <Text key={i} color="gray" wrap="truncate-end">
            {f}
          </Text>
        ))
      )}
    </Box>
  )
}
```

#### 2.4 Create `packages/tui-ink/src/components/InputBar.tsx`
```tsx
import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { TextInput } from "@inkjs/ui"

interface InputBarProps {
  onSubmit: (text: string) => void
}

export function InputBar({ onSubmit }: InputBarProps) {
  const [value, setValue] = useState("")

  return (
    <Box height={3} flexDirection="column" borderStyle={undefined} paddingTop={1}>
      <Box>
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={(submitted) => {
            if (!submitted.trim()) return
            onSubmit(submitted)
            setValue("")
          }}
          placeholder="Type a message and press Enter..."
        />
      </Box>
    </Box>
  )
}
```

#### 2.5 Update `packages/tui-ink/src/app.tsx`
```tsx
import React from "react"
import { Box, useStdoutDimensions } from "ink"
import { Header } from "./components/Header"
import { ChatPane } from "./components/ChatPane"
import { ContextPane } from "./components/ContextPane"
import { InputBar } from "./components/InputBar"

export function App() {
  const { columns, rows } = useStdoutDimensions()

  // Reserve rows: 1 for header, 3 for input bar
  const workspaceHeight = rows - 4

  // Split workspace: 70% chat, 30% context
  const chatWidth = Math.floor(columns * 0.7)
  const contextWidth = columns - chatWidth

  const dummyMessages = [
    { role: "user" as const, content: "Hello, can you help me refactor this function?" },
    { role: "ai" as const, content: "Of course! Please share the function you'd like to refactor." },
  ]

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Header projectName="bettercode" gitBranch="main" status="idle" />

      <Box flexDirection="row" flexGrow={1} height={workspaceHeight}>
        <ChatPane messages={dummyMessages} width={chatWidth} height={workspaceHeight} />
        <ContextPane files={["src/index.ts", "src/utils.ts"]} width={contextWidth} height={workspaceHeight} />
      </Box>

      <InputBar onSubmit={(text) => console.error("Submitted:", text)} />
    </Box>
  )
}
```

#### 2.6 Update `packages/tui-ink/src/index.tsx`
```tsx
import React from "react"
import { render } from "ink"
import { App } from "./app"

render(<App />)
```

### Validation Criteria for M2

Run:
```bash
cd packages/tui-ink
bun run dev
```

**Expected:**
- Full terminal fills with the layout (no empty space below InputBar)
- Header shows "bettercode  main  ready" across the top
- Chat messages visible in the left 70%
- "Context" panel with two files in the right 30%
- Input prompt at the bottom with placeholder text
- **Zero ASCII borders** (`+---+` lines) anywhere
- Resizing the terminal window does not crash the app (test by dragging the terminal corner)

**Failure? Check:**
- `useStdoutDimensions()` is imported from `"ink"` not `"ink/src/..."` — this hook is built-in since Ink v4
- `overflowY` on Box requires Ink v5+. Verify your installed version: `bun pm ls | grep ink`

---

## Milestone 3 — State Management (Zustand)

**Goal:** Replace all hardcoded dummy data with reactive state. Typing in the InputBar and pressing Enter appends a message to the ChatPane.

### Steps

#### 3.1 Create `packages/tui-ink/src/store.ts`
```typescript
import { create } from "zustand"

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

  // Actions
  addMessage: (role: Message["role"], content: string) => void
  appendStream: (chunk: string) => void
  setStatus: (status: AppState["status"]) => void
  setContext: (files: string[]) => void
  clearHistory: () => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export const useAppStore = create<AppState>((set) => ({
  status: "idle",
  chatHistory: [],
  activeContext: [],
  projectName: "bettercode",
  gitBranch: "main",

  addMessage: (role, content) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, { id: generateId(), role, content }],
    })),

  appendStream: (chunk) =>
    set((state) => {
      const history = [...state.chatHistory]
      const last = history[history.length - 1]

      // If the last message is an AI message, append to it
      if (last && last.role === "ai") {
        history[history.length - 1] = { ...last, content: last.content + chunk }
        return { chatHistory: history }
      }

      // Otherwise start a new AI message
      return {
        chatHistory: [...history, { id: generateId(), role: "ai", content: chunk }],
      }
    }),

  setStatus: (status) => set({ status }),

  setContext: (files) => set({ activeContext: files }),

  clearHistory: () => set({ chatHistory: [] }),
}))
```

#### 3.2 Update `packages/tui-ink/src/app.tsx` to use the store

```tsx
import React from "react"
import { Box, useStdoutDimensions } from "ink"
import { Header } from "./components/Header"
import { ChatPane } from "./components/ChatPane"
import { ContextPane } from "./components/ContextPane"
import { InputBar } from "./components/InputBar"
import { useAppStore } from "./store"

export function App() {
  const { columns, rows } = useStdoutDimensions()

  const status = useAppStore((s) => s.status)
  const chatHistory = useAppStore((s) => s.chatHistory)
  const activeContext = useAppStore((s) => s.activeContext)
  const projectName = useAppStore((s) => s.projectName)
  const gitBranch = useAppStore((s) => s.gitBranch)
  const addMessage = useAppStore((s) => s.addMessage)

  const workspaceHeight = rows - 4
  const chatWidth = Math.floor(columns * 0.7)
  const contextWidth = columns - chatWidth

  const handleSubmit = (text: string) => {
    addMessage("user", text)
    // AI response wired in Milestone 4
  }

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Header projectName={projectName} gitBranch={gitBranch} status={status} />

      <Box flexDirection="row" flexGrow={1} height={workspaceHeight}>
        <ChatPane messages={chatHistory} width={chatWidth} height={workspaceHeight} />
        <ContextPane files={activeContext} width={contextWidth} height={workspaceHeight} />
      </Box>

      <InputBar onSubmit={handleSubmit} />
    </Box>
  )
}
```

### Validation Criteria for M3

Run:
```bash
cd packages/tui-ink
bun run dev
```

1. App starts — ChatPane is **empty** (no dummy messages)
2. Type "hello world" in the InputBar and press Enter
3. The ChatPane immediately shows:
   ```
   You
   hello world
   ```
4. Type a second message — it appears **below** the first
5. Input field clears to empty after pressing Enter
6. The layout does **not shift or break** when messages are added

---

## Milestone 4 — SDK & Event Stream Integration

**Goal:** Connect the real opencode server so that actual AI responses stream into the ChatPane.

### Background Reading (do this before coding)

Read these two files carefully:
1. `packages/opencode/src/cli/cmd/tui/context/sdk.tsx` — the SSE subscription loop (lines 71–98 are the most important)
2. `packages/sdk/js/src/client.ts` — `createOpencodeClient()` takes `{ baseUrl, directory, headers }`

The event stream works like this:
1. Call `sdk.client.global.event({ signal })` — returns an async stream
2. Each event has a `.type` string (e.g. `"session.updated"`, `"message.part"`, `"session.error"`)
3. You iterate with `for await (const event of events.stream) { ... }`

### Steps

#### 4.1 Create `packages/tui-ink/src/hooks/useSDK.ts`
```typescript
import { useEffect, useRef } from "react"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { useAppStore } from "../store"

interface UseSDKOptions {
  url: string
  directory?: string
  headers?: Record<string, string>
}

export function useSDK({ url, directory, headers }: UseSDKOptions) {
  const abortRef = useRef<AbortController | null>(null)
  const addMessage = useAppStore((s) => s.addMessage)
  const appendStream = useAppStore((s) => s.appendStream)
  const setStatus = useAppStore((s) => s.setStatus)
  const setContext = useAppStore((s) => s.setContext)

  useEffect(() => {
    const abort = new AbortController()
    abortRef.current = abort

    const client = createOpencodeClient({
      baseUrl: url,
      signal: abort.signal,
      directory,
      headers,
    })

    // Store the client so components can call mutations
    useAppStore.setState({ sdkClient: client })

    // SSE event loop — mirrors packages/opencode/src/cli/cmd/tui/context/sdk.tsx
    ;(async () => {
      while (true) {
        if (abort.signal.aborted) break
        try {
          const events = await client.global.event({ signal: abort.signal })
          for await (const event of events.stream) {
            if (abort.signal.aborted) break
            handleEvent(event)
          }
        } catch {
          if (abort.signal.aborted) break
          // Reconnect after 2s on network error
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    })()

    function handleEvent(event: { type: string; properties: unknown }) {
      switch (event.type) {
        case "session.updated":
          // Session status changes drive the header spinner
          // Cast as needed based on SDK types
          break

        case "message.part": {
          const props = event.properties as { part?: { type?: string; text?: string } }
          if (props.part?.type === "text" && props.part.text) {
            appendStream(props.part.text)
          }
          break
        }

        case "message.updated": {
          const props = event.properties as { info?: { role?: string }; parts?: Array<{ type: string; text?: string }> }
          if (props.info?.role === "assistant") {
            // A complete message arrived (not streaming) — rebuild content from parts
            const text = (props.parts ?? [])
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join("")
            if (text) addMessage("ai", text)
          }
          break
        }

        case "session.error": {
          setStatus("error")
          break
        }
      }
    }

    return () => {
      abort.abort()
    }
  }, [url, directory])
}
```

> **Important:** The exact event type names (`"message.part"`, `"message.updated"`, etc.) must match what the server emits. Check `packages/opencode/src/bus/index.ts` and search for `BusEvent.define` calls to see the full list of event names.

#### 4.2 Add `sdkClient` to the Zustand store

In `store.ts`, extend the `AppState` interface and initial state:

```typescript
import type { OpencodeClient } from "@opencode-ai/sdk"

export interface AppState {
  // ... existing fields ...
  sdkClient: OpencodeClient | null

  // Mutation: send a user message to the server
  sendMessage: (sessionID: string, text: string) => Promise<void>
}

// In create():
sdkClient: null,

sendMessage: async (sessionID, text) => {
  const client = useAppStore.getState().sdkClient
  if (!client) return
  useAppStore.getState().setStatus("generating")
  try {
    await client.session.chat({ sessionID, parts: [{ type: "text", text }] })
  } catch {
    useAppStore.getState().setStatus("error")
  }
},
```

#### 4.3 Update `packages/tui-ink/src/app.tsx`

Add `useSDK` call and wire `sendMessage`:
```tsx
// Add at the top of App():
const { url, directory, headers } = useAppStore((s) => ({
  url: s.serverUrl,
  directory: s.directory,
  headers: s.serverHeaders,
}))
useSDK({ url, directory, headers })

// Replace handleSubmit:
const sendMessage = useAppStore((s) => s.sendMessage)
const currentSessionID = useAppStore((s) => s.currentSessionID)

const handleSubmit = async (text: string) => {
  addMessage("user", text)
  await sendMessage(currentSessionID, text)
}
```

#### 4.4 Add server connection props to the store

Extend `AppState` with:
```typescript
serverUrl: string
directory: string | undefined
serverHeaders: Record<string, string> | undefined
currentSessionID: string
```

These are set by the CLI command (Milestone 5) before the React app mounts:
```typescript
// Called from CLI command before render():
useAppStore.setState({
  serverUrl: args.url,
  directory: args.directory,
  serverHeaders: args.headers,
  currentSessionID: args.sessionID ?? "",
})
```

#### 4.5 Add `<Spinner />` to Header when generating

In `Header.tsx`, import from `@inkjs/ui`:
```tsx
import { Spinner } from "@inkjs/ui"

// Inside Header JSX:
{status === "generating" && <Spinner label=" generating..." />}
```

### Validation Criteria for M4

You need a running opencode server to test. Start it in another terminal:
```bash
# From repo root:
bun opencode serve
```
Note the URL it prints (e.g. `http://localhost:4096`).

Then run the TUI pointing at it:
```bash
OPENCODE_SERVER_URL=http://localhost:4096 bun run dev
```

**Expected:**
1. App connects — no "connection refused" errors
2. If the server has sessions, they don't crash the TUI
3. Type a prompt and press Enter
4. Header briefly shows a spinner labeled "generating..."
5. AI response text streams into the ChatPane, character by character
6. When streaming finishes, spinner disappears and status returns to "ready"

---

## Milestone 5 — CLI Command Registration

**Goal:** Add `opencode tui-ink` as a proper subcommand so users can launch the new TUI the same way as the existing one.

### Steps

#### 5.1 Create `packages/opencode/src/cli/cmd/tui-ink.ts`

Model this directly after `packages/opencode/src/cli/cmd/tui/attach.ts`:

```typescript
import { cmd } from "./cmd"
import { UI } from "@/cli/ui"
import { Instance } from "@/project/instance"
import { TuiConfig } from "@/config/tui"
import { existsSync } from "fs"

export const TuiInkCommand = cmd({
  command: "tui-ink [url]",
  describe: "launch the Ink-based TUI (bettercode surface)",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "opencode server URL (defaults to starting a local server)",
        default: "http://localhost:4096",
      })
      .option("dir", {
        type: "string",
        description: "working directory",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session ID to open",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password",
      }),

  handler: async (args) => {
    const directory = (() => {
      if (!args.dir) return undefined
      try {
        process.chdir(args.dir)
        return process.cwd()
      } catch {
        return args.dir
      }
    })()

    const headers = (() => {
      const password = args.password ?? process.env.OPENCODE_SERVER_PASSWORD
      if (!password) return undefined
      const auth = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`
      return { Authorization: auth }
    })()

    // Dynamically import the tui-ink package to avoid loading React/Ink
    // unless this command is actually invoked
    const { startTuiInk } = await import("@opencode-ai/tui-ink")

    await startTuiInk({
      url: args.url as string,
      directory,
      headers,
      sessionID: args.session,
    })
  },
})
```

#### 5.2 Export a `startTuiInk` function from `packages/tui-ink/src/index.tsx`

Replace the current `render(<App />)` call with a named export:

```tsx
import React from "react"
import { render } from "ink"
import { App } from "./app"
import { useAppStore } from "./store"

export interface TuiInkOptions {
  url: string
  directory?: string
  headers?: Record<string, string>
  sessionID?: string
}

export async function startTuiInk(options: TuiInkOptions): Promise<void> {
  // Seed the Zustand store before rendering
  useAppStore.setState({
    serverUrl: options.url,
    directory: options.directory,
    serverHeaders: options.headers,
    currentSessionID: options.sessionID ?? "",
    projectName: options.directory?.split("/").pop() ?? "bettercode",
  })

  return new Promise<void>((resolve) => {
    const { unmount } = render(<App onExit={resolve} />)

    process.on("SIGINT", () => {
      unmount()
      resolve()
    })
  })
}
```

Pass `onExit` through `App` → `InputBar` for a clean `Ctrl+C` handler.

#### 5.3 Register the command in `packages/opencode/src/index.ts`

Add two lines to the existing file:

```typescript
// Add this import near the other TUI imports (around line 24-25):
import { TuiInkCommand } from "./cli/cmd/tui-ink"

// Add this line in the yargs builder (near where AttachCommand is registered):
.command(TuiInkCommand)
```

### Validation Criteria for M5

```bash
# From repo root
bun opencode --help
```
**Expected:** `tui-ink` appears in the command list.

```bash
bun opencode tui-ink --help
```
**Expected:** Help text shows `url`, `--dir`, `--session`, `--password` options.

```bash
# Start server in another terminal first
bun opencode serve

# Then:
bun opencode tui-ink http://localhost:4096
```
**Expected:** Full TUI launches. AI responses stream correctly.

---

## Milestone 6 — Theming & Keyboard Shortcuts

**Goal:** Make the UI look and feel polished with a Catppuccin-inspired color palette and working keyboard shortcuts.

### Steps

#### 6.1 Create `packages/tui-ink/src/theme.ts`
```typescript
// Catppuccin Mocha palette
export const theme = {
  // Backgrounds
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",

  // Text
  text: "#cdd6f4",
  subtext: "#a6adc8",
  overlay: "#6c7086",

  // Accent colors
  blue: "#89b4fa",
  cyan: "#89dceb",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  pink: "#f5c2e7",
  lavender: "#b4befe",
  mauve: "#cba6f7",

  // Surface
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
} as const

export type Theme = typeof theme
```

#### 6.2 Apply theme colors to components

Update each component to use `theme.*` values instead of plain color strings:

**Header.tsx:**
```tsx
import { theme } from "../theme"

// Replace:  color="cyan"  with:  color={theme.cyan}
// Replace:  color="gray"  with:  color={theme.subtext}
// Replace:  color="green" with:  color={theme.green}
// etc.
```

Apply the same substitution in `ChatPane.tsx`, `ContextPane.tsx`, `InputBar.tsx`.

#### 6.3 Add a vertical divider between panes

In `app.tsx`, between `<ChatPane>` and `<ContextPane>`:
```tsx
<Box width={1} height={workspaceHeight}>
  {Array.from({ length: workspaceHeight }).map((_, i) => (
    <Text key={i} color={theme.surface1}>│</Text>
  ))}
</Box>
```
Adjust `chatWidth` and `contextWidth` to account for the 1-column divider.

#### 6.4 Add keyboard shortcuts via `useInput`

In `app.tsx`:
```tsx
import { useInput } from "ink"

// Inside App():
useInput((input, key) => {
  // Ctrl+C → clean exit
  if (key.ctrl && input === "c") {
    process.exit(0)
  }

  // Ctrl+N → new session
  if (key.ctrl && input === "n") {
    useAppStore.getState().clearHistory()
    useAppStore.getState().setStatus("idle")
  }
})
```

#### 6.5 Add a StatusBar at the bottom

Create `packages/tui-ink/src/components/StatusBar.tsx`:
```tsx
import React from "react"
import { Box, Text } from "ink"
import { theme } from "../theme"

export function StatusBar() {
  return (
    <Box height={1} justifyContent="space-between" backgroundColor={theme.surface0}>
      <Text color={theme.subtext}> ctrl+c exit  ctrl+n new session  enter send </Text>
      <Text color={theme.overlay}>bettercode v0.0.1 </Text>
    </Box>
  )
}
```

Add `<StatusBar />` between the workspace and the InputBar in `app.tsx`. Update `workspaceHeight = rows - 5` to account for it.

### Validation Criteria for M6

1. Launch the TUI — the color scheme is distinctively non-grey (blues, cyans, purples)
2. `Ctrl+C` exits cleanly and restores the shell prompt (no leftover render artifacts)
3. `Ctrl+N` clears the chat history
4. StatusBar is visible at the bottom showing keybind hints
5. The vertical `│` divider between ChatPane and ContextPane is visible

---

## Manual QA Testing Guide

Run this script exactly as written after all milestones are complete. Record pass/fail for each test.

### Setup
```bash
# Terminal 1 — start the server
bun opencode serve

# Terminal 2 — launch the new TUI
bun opencode tui-ink http://localhost:4096
```

---

### Test 1: The Resize Test
**Steps:**
1. Launch the TUI
2. Slowly drag the terminal window smaller (reduce both width and height)
3. Then drag it larger than its original size

**Expected:**
- Layout reflows on every resize
- Header stays at the top, InputBar stays at the bottom
- ChatPane and ContextPane resize proportionally
- App does not crash or show garbled output

**Pass / Fail:** ___

---

### Test 2: Basic Prompt → Response Test
**Steps:**
1. Type: `What is 2 + 2?`
2. Press Enter

**Expected:**
- Your message appears in ChatPane immediately under "You"
- Header shows spinner + "generating..."
- AI response streams into ChatPane under "AI"
- Spinner disappears when streaming ends

**Pass / Fail:** ___

---

### Test 3: Multi-Message Conversation Test
**Steps:**
1. Send 5 messages back-to-back (wait for each response before sending the next)

**Expected:**
- All 5 exchanges visible in ChatPane
- Each response correctly attributed to "AI"
- No message content bleeds into adjacent messages

**Pass / Fail:** ___

---

### Test 4: Long Response Scroll Test
**Steps:**
1. Send: `Write a 100-line Python script with comments`
2. While it streams, observe the ChatPane

**Expected:**
- ChatPane scrolls as content arrives (newest content visible)
- Text wraps at the ChatPane width, not the full terminal width
- ContextPane is not affected by ChatPane overflow

**Pass / Fail:** ___

---

### Test 5: The Interrupt Test
**Steps:**
1. Send a prompt that produces a long response: `Explain the history of computing in detail`
2. While the AI is streaming, press `Ctrl+N` (new session)

**Expected:**
- Chat clears
- A new empty session is ready
- The previous stream stops (no orphaned text appearing after clear)

**Pass / Fail:** ___

---

### Test 6: Empty Input Guard Test
**Steps:**
1. Press Enter without typing anything in the InputBar
2. Press Enter again after typing only spaces

**Expected:**
- Nothing happens (no empty message sent, no API call made)

**Pass / Fail:** ___

---

### Test 7: Graceful Exit Test
**Steps:**
1. Launch the TUI
2. Send a message (start a response generating)
3. Immediately press `Ctrl+C`

**Expected:**
- App exits immediately
- Shell prompt appears cleanly
- No leftover partial renders or cursor artifacts
- Server continues running (only the TUI client disconnected)

**Pass / Fail:** ___

---

### Test 8: Server Reconnect Test
**Steps:**
1. Launch the TUI with a server running
2. Kill the server (`Ctrl+C` in terminal 1)
3. Wait 5 seconds
4. Restart the server

**Expected:**
- TUI does not crash when server goes down
- Status indicator shows "error" or similar degraded state
- After server comes back up, TUI reconnects (may require retry logic in `useSDK`)

**Pass / Fail:** ___

---

## Definition of Done

The implementation is complete when ALL of the following are true:

- [ ] `bun opencode tui-ink --help` works from the repo root
- [ ] All 6 milestones pass their stated validation criteria
- [ ] All 8 manual QA tests pass
- [ ] `bun run typecheck` in `packages/tui-ink` exits with zero errors
- [ ] No `console.log` left in production code paths (use `console.error` for debug, which goes to stderr not the terminal UI)
- [ ] The existing `bun opencode` TUI still works (no regressions)
- [ ] The app exits with code 0 on `Ctrl+C` and code 1 on unrecoverable errors

---

## Hand-off to Lead Engineer

Once all milestones and QA tests are complete, provide a summary to the lead engineer including:
1. Which tests passed/failed
2. Any edge cases discovered during implementation
3. Any deviations from this plan and the reason why
4. Outstanding known issues

The lead engineer will perform a final verification pass against this document.
