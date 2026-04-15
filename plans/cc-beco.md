# CC → BetterCode TUI: Full Improvement Plan

All improvements are drawn directly from studying the Claude Code source at
`/Users/bhaskar.melkani/Documents/Projects/bhaskar/claude-code-src`.
Both projects use Ink (React for terminals), so patterns translate directly.

Implement features in the numbered order below. Each feature has a validation gate —
do not start the next one until the current one is green.

**Validation gate (run from `packages/tui-ink/` after every feature):**
```
bun typecheck    # must be 0 errors
bun test test/   # must be all green
```

---

## Overview

| # | Feature | Files touched | Effort |
|---|---|---|---|
| 1 | Smart line truncation in ToolPart | `ToolPart.tsx` | XS |
| 2 | Rotating hints in Header spinner | `Header.tsx`, `SessionScreen.tsx` | S |
| 3 | Diff display for write tool calls | `ToolPart.tsx` | S |
| 4 | Focus mode (Ctrl+O) | `store.ts`, `SessionScreen.tsx`, `AssistantMessage.tsx`, `ToolPart.tsx`, `StatusBar.tsx` | M |
| 5 | LRU markdown cache + plain-text fast path | `MarkdownRenderer.tsx` | S |
| 6 | Kill ring + Ctrl+K in Composer | `useTextInput.ts`, `Composer.tsx` | S |
| 7 | Scroll wheel acceleration | `mouseScrollEvents.ts`, `index.tsx` (or wherever emit is called) | M |
| 8 | Sticky prompt header | `MessageList.tsx` | M |
| 9 | Transcript search (Ctrl+F) | `store.ts`, `MessageList.tsx`, new `SearchBar.tsx` | L |

---

## Feature 1: Smart Line Truncation in ToolPart

**Why:** Minified JSON, long file paths, or one-line blobs wrap across dozens of terminal
rows. Claude Code truncates individual long lines to terminal width. BetterCode already has
`cut()` (chars) and `line()` (row count) but neither caps line width within a block.

**File:** `packages/tui-ink/src/components/parts/ToolPart.tsx`

### What to add

There are already helpers `cut(text, max)` at line 19 and `line(text, max)` at line 23.
Add `truncLines` immediately after the `line` function (after line 27):

```ts
/** Truncate each line to maxCols chars, then cap total row count. */
function truncLines(text: string, maxCols: number, maxRows: number) {
  const rows = text.split(/\r?\n/).map((row) => cut(row, maxCols))
  if (rows.length <= maxRows) return rows.join("\n")
  return `${rows.slice(0, maxRows).join("\n")}\n… ${rows.length - maxRows} more lines`
}
```

### Where to use it

Inside the `ToolPart` component body, before the `return` statement (after line 85, alongside
`title` and `time`):

```ts
const maxCols = Math.max(40, (process.stdout.columns ?? 120) - 6)
```

Then replace the three body render sites:

**Error body (line 104):**
```tsx
// BEFORE: {line(cut(state.error, 2000), 30)}
// AFTER:
{truncLines(state.error, maxCols, 30)}
```

**Completed output (line 110):**
```tsx
// BEFORE: {line(cut(state.output, 2000), 30)}
// AFTER:
{truncLines(state.output, maxCols, 30)}
```

**Running JSON input (line 116):**
```tsx
// BEFORE: {json(state.input)}
// AFTER:
{truncLines(json(state.input), maxCols, 30)}
```

### Verify

Run a bash tool that outputs minified JSON (e.g. `echo '{"a":1}' | jq -c .` for a large
file). Expand the tool row. Lines must not overflow past the right terminal edge.

---

## Feature 2: Rotating Hints in the Header Spinner

**Why:** The header shows a static "generating" label. Claude Code rotates through the
currently running tool's name (so users see "reading store.ts…" etc.) and cycles through
fallback verbs when the model is thinking between tools.

**Files:**
- `packages/tui-ink/src/screens/SessionScreen.tsx`
- `packages/tui-ink/src/components/Header.tsx`

### Step 1 — derive `hint` from the store in SessionScreen

After line 73 in `SessionScreen.tsx` where `generating` is computed, add:

```ts
const HINTS = ["Thinking…", "Working…", "Processing…", "Reasoning…"]

const hint = useAppStore((s) => {
  if (!generating) return undefined
  const msgs = s.messages[sessionID] ?? []
  const last = [...msgs].reverse().find((m) => m.role === "assistant")
  if (!last) return undefined
  const tools = (s.parts[last.id] ?? []).filter((p) => p.type === "tool")
  const running = tools.find((p) => p.type === "tool" && p.state.status === "running")
  const target = running ?? tools[tools.length - 1]
  if (!target || target.type !== "tool") return undefined
  const st = target.state
  if ("title" in st && st.title) return st.title
  return target.tool
})

const [verbIdx, setVerbIdx] = React.useState(0)
React.useEffect(() => {
  if (!generating) return
  const t = setInterval(() => setVerbIdx((i) => (i + 1) % HINTS.length), 2000)
  return () => clearInterval(t)
}, [generating])

const spinnerHint = hint ?? HINTS[verbIdx]!
```

### Step 2 — pass `hint` to Header

Find the `<Header ... />` call in `SessionScreen.tsx` (line 162) and add the `hint` prop:

```tsx
<Header
  projectName={project}
  gitBranch={branch}
  sessionCount={sessions.length}
  status={isError ? "error" : generating ? "generating" : "idle"}
  width={columns}
  hint={generating ? spinnerHint : undefined}
/>
```

### Step 3 — update Header

In `Header.tsx`, add `hint?: string` to `HeaderProps` (after `width: number`):

```ts
interface HeaderProps {
  projectName: string
  gitBranch: string
  sessionCount: number
  status: "idle" | "generating" | "error"
  width: number
  hint?: string
}
```

Update the destructure signature and the `fill` calculation (lines 21-29):

```ts
export function Header({ projectName, gitBranch, sessionCount, status, width, hint }: HeaderProps) {
  // ...existing derived values...
  const spinnerLabel = status === "generating" ? ` ${hint ?? "generating"}` : undefined
  const rightLabel = status === "generating" ? (hint ?? "generating") : (status === "error" ? "error" : "ready")
  const leftLen = project.length + branch.length + count.length + 6
  const fill = Math.max(0, width - leftLen - rightLabel.length - (status === "generating" ? 1 : 0))
```

Update the spinner render (line 52):

```tsx
// BEFORE: <Spinner label=" generating" />
// AFTER:
<Spinner label={spinnerLabel} />
```

### Verify

Open a tool-heavy session. During generation the header should show each running tool's
title, and cycle through "Thinking…" / "Working…" etc. between tool calls.

---

## Feature 3: Diff Display for Write Tool Calls

**Why:** When a write/edit tool completes, the expanded body shows raw text. Claude Code
renders a color-coded unified diff (green additions, red deletions) so users can see exactly
what changed without opening a separate diff tool.

**File:** `packages/tui-ink/src/components/parts/ToolPart.tsx`

### Helpers to add

Add after the existing `kind()` function (after line 65):

```ts
function isWriteTool(tool: string) {
  const t = tool.toLowerCase()
  return t.includes("write") || t.includes("edit") || t.includes("patch")
}

function looksLikeDiff(text: string) {
  return text.includes("@@") || text.startsWith("---") || text.startsWith("diff ")
}

interface DiffLineProps { row: string; theme: Theme }

function DiffLine({ row, theme }: DiffLineProps) {
  if (row.startsWith("+") && !row.startsWith("+++")) return <Text color={theme.green}>{row}</Text>
  if (row.startsWith("-") && !row.startsWith("---")) return <Text color={theme.red}>{row}</Text>
  if (row.startsWith("@@")) return <Text color={theme.cyan}>{row}</Text>
  if (row.startsWith("---") || row.startsWith("+++")) return <Text color={theme.overlay}>{row}</Text>
  return <Text color={theme.subtext}>{row}</Text>
}
```

`Theme` is already imported at the top of the file.

### Where to use it

Inside the `ToolPart` component, replace the completed-state render block. Currently at
lines 107–112 it renders a single `<Text>`. Change it to:

```tsx
state.status === "completed" ? (
  (() => {
    if (isWriteTool(part.tool) && looksLikeDiff(state.output)) {
      const rows = state.output.split(/\r?\n/).map((r) => cut(r, maxCols))
      const visible = rows.slice(0, 30)
      const extra = rows.length - visible.length
      return (
        <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.surface0} flexDirection="column">
          {visible.map((row, i) => <DiffLine key={i} row={row} theme={theme} />)}
          {extra > 0 && <Text color={theme.overlay}>… {extra} more lines</Text>}
        </Box>
      )
    }
    return (
      <Box marginTop={1} paddingLeft={1} borderLeft={true} borderColor={theme.surface0} flexDirection="column">
        <Text wrap="wrap" color={theme.subtext}>
          {truncLines(state.output, maxCols, 30)}
        </Text>
      </Box>
    )
  })()
)
```

Note: `maxCols` is the constant derived earlier in this component. If the backend does not
return a unified diff in `state.output`, `looksLikeDiff` returns false and the plain text
fallback renders — no regression.

### Verify

Open a session that edits a file. Expand the completed write/edit tool call. If the output
contains diff markers, lines render in green/red/cyan. Otherwise plain text as before.

---

## Feature 4: Focus Mode (Ctrl+O)

**Why:** Long sessions accumulate dozens of tool rows and intermediate text. Claude Code's
focus mode hides everything except the final response text in each turn and keeps all tool
rows collapsed, making it easy to read what actually happened.

**Files:**
- `src/store.ts`
- `src/screens/SessionScreen.tsx`
- `src/components/AssistantMessage.tsx`
- `src/components/parts/ToolPart.tsx`
- `src/components/StatusBar.tsx`

### Step 1 — store

In `AppState` interface (after `showThinking: boolean`, line 121):
```ts
focusMode: boolean
toggleFocusMode: () => void
```

In the `create<AppState>(...)` initializer (after `showThinking: false`, line 305):
```ts
focusMode: false,
```

After `setShowThinking` action (line 328):
```ts
toggleFocusMode: () => set((prev) => ({ focusMode: !prev.focusMode })),
```

### Step 2 — Ctrl+O in SessionScreen

Inside the `useInput` handler (line 93), add before the closing brace:
```ts
if (key.ctrl && _input === "o") {
  useAppStore.getState().toggleFocusMode()
  return
}
```

### Step 3 — AssistantMessage

Add after `const theme = useTheme()`:
```ts
const focusMode = useAppStore((s) => s.focusMode)
```

Replace the `parts.map(...)` block (line 71) with:
```tsx
{parts.map((part, idx) => {
  if (part.type === "text") {
    if (part.synthetic || part.ignored) return null
    if (focusMode) {
      const lastIdx = parts.reduce((last, p, i) =>
        p.type === "text" && !p.synthetic && !p.ignored ? i : last, -1)
      if (idx !== lastIdx) return null
    }
    const out = <TextPart key={part.id} part={part} lead={lead ? "◆" : undefined} />
    lead = false
    return out
  }
  if (part.type === "reasoning") return <ReasoningPart key={part.id} part={part} visible={showThinking} />
  if (part.type === "tool") return <ToolPart key={part.id} part={part} />
  if (part.type === "compaction") return <CompactionPart key={part.id} />
  return null
})}
```

### Step 4 — ToolPart

After the `collapsed` selector (line 78):
```ts
const focusMode = useAppStore((s) => s.focusMode)
```

Change the `open` derivation (line 82):
```ts
// BEFORE: const open = isOpen(state.status, collapsed)
const open = focusMode ? false : isOpen(state.status, collapsed)
```

### Step 5 — StatusBar

After the `autoAccept` selector (line 30):
```ts
const focusMode = useAppStore((s) => s.focusMode)
```

Add `focusMode` case at the top of the `raw` hint chain:
```ts
const raw = focusMode
  ? "ctrl+o: exit focus"
  : perms
  ? "y: allow · a: allow all · n: deny"
  : /* ...rest unchanged... */
```

### Verify

1. Press `Ctrl+O` in a long session — all tool bodies collapse, only final text stays visible.
2. Footer shows `ctrl+o: exit focus`.
3. Press `Ctrl+O` again — everything returns to its previous state.

---

## Feature 5: LRU Markdown Cache + Plain-Text Fast Path

**Why:** `MarkdownRenderer.tsx` currently calls `marked.lexer(text)` on every re-render via
`useMemo`. Claude Code caches lexer results by content hash (LRU, max 500 entries) and adds
a fast path that skips the lexer entirely for plain text — saving ~3ms per message on long
sessions. The height cache in `MessageList.tsx` calls `lex()` repeatedly too.

**File:** `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`

### Step 1 — add the cache module

Add these constants and functions at the top of the file, after the imports (before line 9):

```ts
// LRU token cache — module-scoped, survives re-renders.
// Key = content string, Value = Token[]. Max 500 entries, FIFO eviction.
const TOKEN_CACHE = new Map<string, Token[]>()
const TOKEN_CACHE_MAX = 500

function cachedLex(text: string): Token[] {
  const hit = TOKEN_CACHE.get(text)
  if (hit) {
    // Promote to MRU: delete and re-insert moves to end of insertion order
    TOKEN_CACHE.delete(text)
    TOKEN_CACHE.set(text, hit)
    return hit
  }
  const result = marked.lexer(text, opts) as Token[]
  if (TOKEN_CACHE.size >= TOKEN_CACHE_MAX) {
    // Evict oldest (first entry)
    TOKEN_CACHE.delete(TOKEN_CACHE.keys().next().value!)
  }
  TOKEN_CACHE.set(text, result)
  return result
}

// Markdown fast-path check — scan first 500 chars for syntax markers.
// If none found, the text is plain prose: skip the lexer.
const MD_MARKERS = /[*_`#\[\]!>|~\\]/
function hasMarkdownSyntax(text: string): boolean {
  return MD_MARKERS.test(text.slice(0, 500))
}
```

### Step 2 — update `lex()` to use the cache

The exported `lex()` function (line 11) is used by `MessageList.tsx` for height estimation.
Replace it:

```ts
// BEFORE:
export function lex(text: string) {
  return marked.lexer(text, opts) as Token[]
}

// AFTER:
export function lex(text: string) {
  return cachedLex(text)
}
```

### Step 3 — apply fast path in MarkdownRenderer

Inside `MarkdownRenderer`, replace the `useMemo` (line 26):

```ts
// BEFORE:
const tokens = useMemo(() => lex(text), [text])

// AFTER:
const tokens = useMemo(() => {
  if (!hasMarkdownSyntax(text)) {
    // Plain text fast path: single paragraph token, no lexer needed
    return [{ type: "paragraph", raw: text, text, tokens: [{ type: "text", raw: text, text }] }] as Token[]
  }
  return cachedLex(text)
}, [text])
```

### Step 4 — export cache clear for tests

Add at the bottom of the file (before the last line):

```ts
/** Clear the token cache. Used in tests. */
export function clearTokenCache(): void {
  TOKEN_CACHE.clear()
}
```

### Verify

In a long session (30+ messages), streaming new tokens should feel faster and the terminal
should stay responsive. No visual changes — the render output is identical.
Run `bun typecheck` to confirm `lex` still satisfies callers in `MessageList.tsx`.

---

## Feature 6: Kill Ring + Ctrl+K in Composer

**Why:** Claude Code implements readline-style kill ring: `Ctrl+K` kills text from cursor to
end of line (appends to ring), `Ctrl+W` also appends to ring, and `Ctrl+Y` yanks the most
recently killed text back. This makes editing long prompts much faster. BetterCode already
has `Ctrl+W` delete-word but no ring, and no `Ctrl+K`.

**Files:**
- `packages/tui-ink/src/hooks/useTextInput.ts`
- `packages/tui-ink/src/components/Composer.tsx`

### Step 1 — add kill-ring helpers to `useTextInput.ts`

Add after `textDelWord` (after line 48):

```ts
// Ctrl+K: kill from cursor to end of line; returns [nextValue, killedText].
export function textKillLine(value: string, cursor: number): [string, string] {
  const nl = value.indexOf("\n", cursor)
  const end = nl === -1 ? value.length : nl
  if (cursor === end) {
    // Cursor is at end of line — kill the newline itself
    return [value.slice(0, cursor) + value.slice(cursor + 1), "\n"]
  }
  return [value.slice(0, cursor) + value.slice(end), value.slice(cursor, end)]
}
```

Add `killRing` and `yank` to `useTextInput`:

Inside `useTextInput` (after the `lineDown` action, before the `return`):

```ts
const [ring, setRing] = useState<string[]>([])
const [yankIdx, setYankIdx] = useState(0)

// Append to kill ring (accumulate consecutive kills).
const kill = (text: string) => {
  setRing((prev) => {
    const next = [...prev, text]
    // Keep ring bounded to 20 entries
    return next.length > 20 ? next.slice(next.length - 20) : next
  })
  setYankIdx(0)
}

const killLine = () =>
  setState((s) => {
    const [v, killed] = textKillLine(s.value, s.cursor)
    if (killed) kill(killed)
    return { value: v, cursor: s.cursor }
  })

const yank = () =>
  setState((s) => {
    if (ring.length === 0) return s
    const text = ring[ring.length - 1 - yankIdx] ?? ""
    const [v, c] = textInsertAt(s.value, s.cursor, text)
    return { value: v, cursor: c }
  })

const yankPop = () => {
  setYankIdx((i) => (i + 1) % Math.max(1, ring.length))
  yank()
}
```

Add `killLine`, `yank`, `yankPop` to the return object:

```ts
return {
  value: state.value,
  cursor: state.cursor,
  setValue, insert, del, deleteForward, deleteKey, deleteWord,
  moveLeft, moveRight, home, end, clear, newline, lineUp, lineDown,
  killLine, yank, yankPop,   // ← add these
}
```

### Step 2 — wire Ctrl+K and updated Ctrl+Y in Composer

In `Composer.tsx`, add `killLine`, `yank`, `yankPop` to the destructure of `useTextInput()`
(line 42):

```ts
const {
  value, cursor, setValue, insert, del, deleteKey, deleteWord,
  moveLeft, moveRight, home, end, clear, newline, lineUp, lineDown,
  killLine, yank, yankPop,   // ← add these
} = useTextInput()
```

In the **non-generating** `useInput` handler (the one with `{ isActive: active && !generating }`,
line 232), add after the `Ctrl+W` block:

```ts
if (key.ctrl && input === "k") {
  killLine()
  return
}
```

Replace the existing `Ctrl+Y` handler (which currently restores the stash) with a two-step
handler that first checks the kill ring, then falls back to stash:

```ts
// BEFORE:
if (key.ctrl && input === "y") {
  if (stash) {
    setValue((v) => v + stash)
    setPromptStash(null)
  }
  return
}

// AFTER:
if (key.ctrl && input === "y") {
  yank()  // yank from kill ring
  return
}
// Alt+Y (meta+y) — cycle through kill ring (yank-pop)
if (key.meta && input === "y") {
  yankPop()
  return
}
```

Do the same replacement in the **generating** `useInput` handler (line 126).

Note: the stash (`Ctrl+X` / `Ctrl+Y` for stash restore) was the previous `Ctrl+Y` behavior.
Keep `Ctrl+X` to push to stash as before, but `Ctrl+Y` now yanks from the kill ring. The
stash feature is still accessible — just document the new behavior in the placeholder text
if desired.

### Test to add

In `test/useTextInput.test.ts` (or create `test/killring.test.ts`), add:

```ts
import { textKillLine } from "../src/hooks/useTextInput"

test("textKillLine kills to end of line", () => {
  expect(textKillLine("hello world", 5)).toEqual(["hello", " world"])
})
test("textKillLine kills newline when at end of line", () => {
  expect(textKillLine("hello\nworld", 5)).toEqual(["helloworld", "\n"])
})
test("textKillLine at end of string is no-op", () => {
  expect(textKillLine("hello", 5)).toEqual(["hello", ""])
})
```

### Verify

In the Composer, type a long prompt, move the cursor to the middle of a line with
`Ctrl+A`, then press `Ctrl+K`. Text from cursor to end should disappear. Press `Ctrl+Y` —
it should come back.

---

## Feature 7: Scroll Wheel Acceleration

**Why:** BetterCode currently scrolls 3 rows per wheel event — flat, no momentum. Claude
Code implements per-emulator scroll physics: native terminals get a linear ramp (up to 6×
speed) that resets after 1500ms of idle; xterm-based editors (VS Code, Cursor) get
exponential decay momentum with fractional carry. The result is snappy scroll on trackpad
and fast scroll on mouse wheel.

**Files:**
- `packages/tui-ink/src/mouseScrollEvents.ts` — add acceleration state
- Wherever `mouseScrollEvents.emit()` is called (find with `grep -r "mouseScrollEvents.emit" src/`)

### Step 1 — update `mouseScrollEvents.ts`

Replace the entire file with:

```ts
type Direction = "up" | "down"
type Handler = (direction: Direction, rows: number) => void

const handlers = new Set<Handler>()

// Acceleration state
let lastEventMs = 0
let lastDir: Direction | null = null
let multiplier = 1
let pendingFraction = 0

// Detect xterm.js (VS Code / Cursor / Windsurf embedded terminal)
const isXterm = process.env.TERM_PROGRAM === "vscode"

// Native terminal constants
const RAMP_STEP = 0.5       // multiplier increase per event in the ramp window
const RAMP_WINDOW_MS = 80   // events within this gap accelerate
const RAMP_MAX = 6          // maximum multiplier
const IDLE_RESET_MS = 1500  // reset multiplier after this idle gap

// xterm.js constants
const DECAY_HALFLIFE_MS = 150   // halve momentum every N ms
const DECAY_STEP = 5
const DECAY_CAP = 6
const BURST_MS = 5              // events <5ms apart = trackpad burst, cap at 1 row

export const mouseScrollEvents = {
  emit(direction: Direction) {
    const now = Date.now()
    const gap = now - lastEventMs
    lastEventMs = now

    let rows: number

    if (isXterm) {
      // xterm.js: exponential decay momentum
      if (gap < BURST_MS) {
        // Trackpad burst — 1 row per event
        rows = 1
      } else {
        const momentum = Math.pow(0.5, gap / DECAY_HALFLIFE_MS)
        multiplier = Math.min(DECAY_CAP, 1 + (multiplier - 1) * momentum + DECAY_STEP * (1 - momentum))
        pendingFraction += multiplier
        rows = Math.floor(pendingFraction)
        pendingFraction -= rows
      }
    } else {
      // Native terminal: linear ramp
      if (gap > IDLE_RESET_MS || direction !== lastDir) {
        // Idle reset or direction change
        multiplier = 1
        pendingFraction = 0
      } else if (gap < RAMP_WINDOW_MS) {
        multiplier = Math.min(RAMP_MAX, multiplier + RAMP_STEP)
      }
      rows = Math.max(1, Math.round(multiplier))
    }

    lastDir = direction

    for (const h of handlers) h(direction, Math.max(1, rows))
  },

  on(handler: Handler): () => void {
    handlers.add(handler)
    return () => handlers.delete(handler)
  },
}
```

### Step 2 — update the handler signature in MessageList

In `MessageList.tsx`, the scroll subscription at line 306 currently receives only
`direction`. Update it to receive `rows` too:

```ts
// BEFORE:
return mouseScrollEvents.on((direction) => {
  if (!activeRef.current) return
  if (direction === "up") {
    setRowOffset((o) => Math.min(o + MOUSE_SCROLL_STEP, maxRowOffsetRef.current))
  } else {
    setRowOffset((o) => Math.max(0, o - MOUSE_SCROLL_STEP))
  }
})

// AFTER:
return mouseScrollEvents.on((direction, rows) => {
  if (!activeRef.current) return
  if (direction === "up") {
    setRowOffset((o) => Math.min(o + rows, maxRowOffsetRef.current))
  } else {
    setRowOffset((o) => Math.max(0, o - rows))
  }
})
```

Remove the `MOUSE_SCROLL_STEP` constant (line 191) as it is no longer used:
```ts
// Delete this line:
const MOUSE_SCROLL_STEP = 3
```

### Step 3 — find other callers

Run `grep -r "mouseScrollEvents" src/` to find any other subscribers. Update their handler
signatures to accept the second `rows: number` argument.

### Verify

With a mouse wheel: scrolling should accelerate as you spin faster and reset when idle.
With a trackpad: scrolling should feel linear and controlled (burst detection prevents
runaway acceleration).

---

## Feature 8: Sticky Prompt Header

**Why:** When scrolled up in a long session, the user loses track of what prompt triggered
the current response. Claude Code pins the user's most recent prompt text as a sticky
header at the top of the transcript viewport. The header disappears when at the bottom.

**File:** `packages/tui-ink/src/components/MessageList.tsx`

### Step 1 — extract the sticky prompt text

Add a pure helper after the `estimateHeight` function (after line 149 in `MessageList.tsx`):

```ts
/** Extract the plain text of the last user message for the sticky prompt header. */
function stickyPromptText(messages: Message[], parts: Record<string, Part[]>): string {
  const last = [...messages].reverse().find((m) => m.role === "user")
  if (!last) return ""
  const textPart = (parts[last.id] ?? []).find((p): p is TextPartType => p.type === "text" && !p.synthetic)
  if (!textPart) return ""
  // Take first line only; strip markdown, cap to 80 chars
  const first = textPart.text.split("\n")[0] ?? ""
  return first.length > 80 ? `${first.slice(0, 79)}…` : first
}
```

### Step 2 — compute it in the component

Inside the `MessageList` component body, after the `pending` useMemo (line 210), add:

```ts
const sticky = rowOffset === 0
const stickyPrompt = useMemo(
  () => (sticky ? "" : stickyPromptText(messages, parts)),
  [messages, parts, sticky],
)
```

Note: `sticky` is already defined on line 223 as `rowOffset === 0`. Move this `const sticky`
declaration up before `stickyPrompt` so it can be used. (Remove the duplicate declaration
at line 223.)

### Step 3 — render the sticky header

Inside the `return` statement, add the sticky header inside the `<Box height={height}>`,
before the scroll indicator:

```tsx
{/* Sticky prompt — shows last user message when scrolled up */}
{stickyPrompt && (
  <Box
    position="absolute"
    width={width}
    flexDirection="row"
    paddingLeft={1}
    paddingRight={1}
  >
    <Text color={theme.cyan} bold wrap="truncate-end">
      {"▶ "}
    </Text>
    <Text color={theme.subtext} wrap="truncate-end">
      {stickyPrompt}
    </Text>
  </Box>
)}
```

Add `const theme = useTheme()` to the component if not already present. (`useTheme` is
imported from `"../theme-context"`.)

### Verify

In a session with many messages, scroll up past the user's last prompt. The first line of
the last user message should appear pinned at the top of the message area. Scrolling back
to the bottom makes it disappear.

---

## Feature 9: Transcript Search (Ctrl+F)

**Why:** Long sessions are hard to navigate. Claude Code supports full-text search with
highlighted matches and n/N navigation. BetterCode has no search at all.

**Files:**
- `src/store.ts` — `searchMode`, `searchQuery`, `searchMatchIdx`
- New file: `src/components/SearchBar.tsx`
- `src/components/MessageList.tsx` — match detection + navigation
- `src/screens/SessionScreen.tsx` — Ctrl+F handler, pass search props
- `src/components/StatusBar.tsx` — hint update

### Step 1 — store additions

In `AppState` interface (after `focusMode` that was added in Feature 4):
```ts
searchMode: boolean
searchQuery: string
searchMatchIdx: number
openSearch: () => void
closeSearch: () => void
setSearchQuery: (q: string) => void
nextSearchMatch: () => void
prevSearchMatch: () => void
```

In the initializer:
```ts
searchMode: false,
searchQuery: "",
searchMatchIdx: 0,
```

Actions:
```ts
openSearch: () => set({ searchMode: true, searchQuery: "", searchMatchIdx: 0 }),
closeSearch: () => set({ searchMode: false, searchQuery: "", searchMatchIdx: 0 }),
setSearchQuery: (q) => set({ searchQuery: q, searchMatchIdx: 0 }),
nextSearchMatch: () => set((prev) => ({ searchMatchIdx: prev.searchMatchIdx + 1 })),
prevSearchMatch: () => set((prev) => ({ searchMatchIdx: Math.max(0, prev.searchMatchIdx - 1) })),
```

### Step 2 — SearchBar component

Create `packages/tui-ink/src/components/SearchBar.tsx`:

```tsx
import React, { useEffect, useRef } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../theme-context"
import { useAppStore } from "../store"
import { useTextInput } from "../hooks/useTextInput"

interface Props {
  matchCount: number
  active: boolean
}

export function SearchBar({ matchCount, active }: Props) {
  const theme = useTheme()
  const { value, cursor, insert, del, clear, home, end, moveLeft, moveRight } = useTextInput()
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const matchIdx = useAppStore((s) => s.searchMatchIdx)
  const closeSearch = useAppStore((s) => s.closeSearch)
  const nextMatch = useAppStore((s) => s.nextSearchMatch)
  const prevMatch = useAppStore((s) => s.prevSearchMatch)

  // Sync local input value to store query
  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  useInput(
    (input, key) => {
      if (key.escape) { closeSearch(); return }
      if (key.return) { nextMatch(); return }
      if (key.ctrl && input === "n") { nextMatch(); return }
      if (key.ctrl && input === "p") { prevMatch(); return }
      if (key.ctrl && input === "a") { home(); return }
      if (key.ctrl && input === "e") { end(); return }
      if (key.leftArrow) { moveLeft(); return }
      if (key.rightArrow) { moveRight(); return }
      if (key.backspace) { del(); return }
      if (key.ctrl || key.meta) return
      if (input) insert(input)
    },
    { isActive: active },
  )

  const label = matchCount === 0
    ? " no matches"
    : ` ${Math.min(matchIdx + 1, matchCount)}/${matchCount}`

  // Split value at cursor for caret rendering
  const before = value.slice(0, cursor)
  const at = value[cursor] ?? " "
  const after = value.slice(cursor + 1)

  return (
    <Box height={1} flexDirection="row" paddingLeft={1}>
      <Text color={theme.cyan}>{"/ "}</Text>
      <Text color={theme.text}>{before}</Text>
      <Text backgroundColor={theme.cyan} color={theme.base}>{at}</Text>
      <Text color={theme.text}>{after}</Text>
      <Text color={matchCount === 0 ? theme.red : theme.overlay}>{label}</Text>
      <Text color={theme.overlay}>{" · enter/ctrl+n: next · ctrl+p: prev · esc: close"}</Text>
    </Box>
  )
}
```

### Step 3 — match detection in MessageList

In `MessageList.tsx`, add a `useAppStore` selector inside the component to get search state:

```ts
const searchMode = useAppStore((s) => s.searchMode)
const searchQuery = useAppStore((s) => s.searchQuery)
const searchMatchIdx = useAppStore((s) => s.searchMatchIdx)
```

Add a `matches` computation after the `totalHeight/cumH` useMemo:

```ts
// Indices of messages that contain the search query (case-insensitive).
const matches = useMemo(() => {
  if (!searchMode || !searchQuery.trim()) return []
  const q = searchQuery.toLowerCase()
  return messages
    .map((msg, i) => {
      const msgParts = parts[msg.id] ?? EMPTY_ARRAY
      const text = msgParts
        .filter((p): p is TextPartType => p.type === "text" && !p.synthetic && !p.ignored)
        .map((p) => p.text)
        .join(" ")
        .toLowerCase()
      return text.includes(q) ? i : -1
    })
    .filter((i) => i !== -1)
}, [searchMode, searchQuery, messages, parts])
```

Use `searchMatchIdx` to jump to the current match. Add a `useEffect` that scrolls to the
matching message when `searchMatchIdx` or `matches` changes:

```ts
useEffect(() => {
  if (matches.length === 0) return
  const idx = ((searchMatchIdx % matches.length) + matches.length) % matches.length
  const msgIdx = matches[idx]
  if (msgIdx === undefined) return
  // Scroll so the matching message is visible: compute its row offset from bottom
  const msgTop = cumH[msgIdx] ?? 0
  const msgBottom = cumH[msgIdx + 1] ?? 0
  const msgCenter = (msgTop + msgBottom) / 2
  const targetOffset = Math.max(0, totalHeight - msgCenter - Math.floor(height / 2))
  setRowOffset(Math.min(targetOffset, maxRowOffset))
}, [searchMatchIdx, matches])
```

Pass `matches.length` up so `SearchBar` can show match count. The cleanest way is to
store it in the Zustand store or pass as a prop via `SessionScreen`. The prop approach is
simpler: add `searchMatchCount` as a new state field in the store and write it from
`MessageList` using `useEffect`:

In the store, add:
```ts
searchMatchCount: number
setSearchMatchCount: (n: number) => void
```
Initialize to `0`. Action: `setSearchMatchCount: (n) => set({ searchMatchCount: n })`.

In `MessageList`, add:
```ts
const setSearchMatchCount = useAppStore((s) => s.setSearchMatchCount)
useEffect(() => { setSearchMatchCount(matches.length) }, [matches.length])
```

Add a green left-border highlight on messages that match:

In the `win.map(...)` render block, when rendering `AssistantMessage` or `UserMessage`,
pass a `highlight` prop if the message index is in `matches`:

```tsx
// For matching messages, wrap in a highlighted Box
const msgIdx = messages.indexOf(msg)
const isMatch = matches.includes(msgIdx)
const currentMatch = matches[((searchMatchIdx % matches.length) + matches.length) % matches.length]
const isCurrent = isMatch && msgIdx === currentMatch
```

Then wrap each message render:
```tsx
<Box key={msg.id} borderLeft={isCurrent} borderColor={theme.yellow} paddingLeft={isCurrent ? 0 : 0}>
  {/* existing UserMessage / AssistantMessage render */}
</Box>
```

### Step 4 — Ctrl+F in SessionScreen

In `SessionScreen.tsx`, add `openSearch` to the store selectors:
```ts
const openSearch = useAppStore((s) => s.openSearch)
const searchMode = useAppStore((s) => s.searchMode)
const searchMatchCount = useAppStore((s) => s.searchMatchCount)
```

In the `useInput` handler, add:
```ts
if (key.ctrl && _input === "f") {
  openSearch()
  return
}
```

### Step 5 — render SearchBar

In `SessionScreen.tsx`, import `SearchBar`:
```ts
import { SearchBar } from "../components/SearchBar"
```

In the JSX, add `SearchBar` between `Header` and the `MessageList`/`ErrorBoundary` block.
It should only render when `searchMode` is true:

```tsx
{searchMode && (
  <SearchBar matchCount={searchMatchCount} active={active && searchMode} />
)}
```

The `listHeight` calculation should subtract 1 row when SearchBar is visible:
```ts
const searchRows = searchMode ? 1 : 0
const listHeight = Math.max(1, rows - 2 - dockRows - searchRows)
```

### Step 6 — StatusBar hint

Add to the `raw` hint chain (after the `focusMode` case):
```ts
const raw = focusMode
  ? "ctrl+o: exit focus"
  : searchMode
  ? "enter/ctrl+n: next · ctrl+p: prev · esc: close"
  : /* ...rest unchanged... */
```

### Verify

1. Press `Ctrl+F`. A search bar appears between the header and message list.
2. Type a word that appears in the transcript. Matching messages get a yellow left border.
3. Press `Enter` or `Ctrl+N` — jumps to next match.
4. Press `Ctrl+P` — jumps to previous match.
5. Press `Esc` — search closes, view returns to previous position.
6. Searching for something not present shows "no matches" in red.

---

## Full Regression Checklist

Run after all 9 features are complete:

- [ ] Streaming session: tool calls update live, text streams correctly
- [ ] Sticky scroll: new messages pull view to bottom while at bottom
- [ ] Detached scroll: scroll up during generation; view holds position; `Ctrl+↓` snaps back
- [ ] Focus mode: `Ctrl+O` collapses prose/tools; `Ctrl+O` again restores; footer hint correct
- [ ] Search: `Ctrl+F` opens bar; typing filters; `Enter`/`Ctrl+N`/`Ctrl+P` navigate; `Esc` closes
- [ ] Kill ring: `Ctrl+K` kills to EOL; `Ctrl+Y` yanks back; `Alt+Y` cycles ring
- [ ] Tool collapse: individual tools still toggle with Enter/Space; error tools still auto-expand
- [ ] Diff display: write tools with diff output show colored lines; plain output falls back
- [ ] Scroll acceleration: mouse wheel speeds up on spin, resets on pause
- [ ] Sticky prompt: scrolling up shows last user prompt at top; disappears at bottom
- [ ] Narrow terminal (80×24): no overflow, sidebar refuses to open
- [ ] Terminal resize while streaming: no blank screen, heights recalculate
- [ ] Session switching: scroll position, focus mode, and search state all reset per session
- [ ] `bun typecheck` — 0 errors
- [ ] `bun test test/` — all tests green

---

## Reference

All patterns sourced from:
```
/Users/bhaskar.melkani/Documents/Projects/bhaskar/claude-code-src/src/
  hooks/useTextInput.ts       — kill ring, vim mode, cursor
  hooks/useVirtualScroll.ts   — virtual scroll, height estimation
  components/Markdown.tsx     — LRU token cache, plain-text fast path
  components/Spinner.tsx      — glimmer/shimmer, verb rotation
  components/VirtualMessageList.tsx — sticky prompt, search, match highlight
  components/ScrollKeybindingHandler.tsx — wheel acceleration algorithms
  components/FileEditToolDiff.tsx — diff rendering
  state/store.ts              — lightweight observer store pattern
```
