# CC → BetterCode TUI: Phase 2 Improvement Plan

This is the second batch of TUI improvements drawn from studying the Claude Code
source at `/Users/bhaskar.melkani/Documents/Projects/bhaskar/claude-code-src`.
Phase 1 (`cc-beco.md`) covers 9 features; this plan covers 14 additional milestones.

Both projects use Ink (React for terminals), so patterns translate directly.
Do **not** blindly copy CC code — adapt each feature to OpenCode's architecture
and conventions.

**Validation gate (run from `packages/tui-ink/` after every milestone):**

```
bun typecheck    # must be 0 errors
bun test test/   # must be all green
```

**Execution protocol:**

1. Implement one milestone at a time.
2. After finishing, mark the TODO as `[x]` below.
3. Clear context or start a new chat before starting the next milestone.
4. Do not start M(N+1) until M(N) is stable and green.
5. At the end of every milestone, write a copy-paste handoff prompt for the next Codex session.

**Milestone handoff rule:**

- Every milestone closeout must include a ready-to-paste prompt for the next chat.
- The prompt must mention:
  - repo path
  - active plan path
  - completed milestones
  - next milestone to execute
  - the one-milestone-at-a-time rule
  - required validation from `packages/tui-ink`
  - instruction to update the tracker in this plan before stopping
- Keep the prompt compact so a new session can start without rebuilding context from zero.

---

## Progress Tracker

- [x] M1 — Composer Editing Power (undo, external editor, reverse history search)
- [x] M2 — Pager Mode Keys (vim-style scrolling when detached)
- [x] M3 — Token & Context Warning (usage bar + compact suggestion)
- [x] M4 — Rich Spinner (shimmer, stall detection, thinking timer)
- [x] M5 — Unseen Messages (divider + jump-to-bottom pill)
- [x] M6 — OffscreenFreeze (freeze offscreen children)
- [x] M7 — Text Selection & Copy (mouse drag, clipboard)
- [x] M8 — Message Actions (cursor navigation, copy, edit/resubmit)
- [x] M9 — True Virtual Scrolling (viewport+overscan, binary search, quantization)
- [x] M10 — Configurable Keybindings (keybindings.json, context-based)
- [x] M11 — Design System Primitives (Pane, Dialog, FuzzyPicker, ProgressBar)
- [ ] M12 — Vim Mode (normal/insert, motions, operators, text objects)
- [ ] M13 — Image Paste (Ctrl+V, image pills, clipboard detection)
- [ ] M14 — Input Syntax Highlights (/commands blue, @mentions colored)

---

## Overview

| M#  | Milestone                | Files touched                                                                        | Effort |
| --- | ------------------------ | ------------------------------------------------------------------------------------ | ------ |
| 1   | Composer Editing Power   | `useTextInput.ts`, `Composer.tsx`, new `useUndoBuffer.ts`, new `useHistorySearch.ts` | M      |
| 2   | Pager Mode Keys          | `MessageList.tsx`, `store.ts`                                                        | S      |
| 3   | Token & Context Warning  | new `TokenWarning.tsx`, `StatusBar.tsx`, `store.ts`                                  | M      |
| 4   | Rich Spinner             | `Spinner.tsx`, `Header.tsx`                                                          | M      |
| 5   | Unseen Messages          | `MessageList.tsx`, `store.ts`                                                        | S      |
| 6   | OffscreenFreeze          | new `OffscreenFreeze.tsx`, `MessageList.tsx`                                         | S      |
| 7   | Text Selection & Copy    | `MessageList.tsx`, new `useTextSelection.ts`, new `clipboard.ts`                     | L      |
| 8   | Message Actions          | `MessageList.tsx`, `store.ts`, new `MessageActions.tsx`                              | L      |
| 9   | True Virtual Scrolling   | `MessageList.tsx`, new `useVirtualScroll.ts`                                         | XL     |
| 10  | Configurable Keybindings | new `keybindings/` directory, `store.ts`                                             | L      |
| 11  | Design System Primitives | new `design-system/` directory                                                       | M      |
| 12  | Vim Mode                 | new `vim/` directory, `useTextInput.ts`, `Composer.tsx`                              | XL     |
| 13  | Image Paste              | `Composer.tsx`, `useTextInput.ts`, new `imagePaste.ts`                               | M      |
| 14  | Input Syntax Highlights  | `Composer.tsx`, new `useHighlights.ts`                                               | S      |

---

## M1: Composer Editing Power

**Why:** The composer (`useTextInput.ts`, 173 lines) has no undo, no external editor
support, and no reverse history search. CC has all three. These are high-value, low-risk
improvements that make the input feel professional.

**CC reference:**

- `src/hooks/useInputBuffer.ts` — undo buffer (debounced snapshots, 50-entry max)
- `src/utils/promptEditor.ts` — external editor via `$EDITOR`
- `src/hooks/useHistorySearch.ts` + `src/components/PromptInput/HistorySearchInput.tsx` — Ctrl+R

### M1a — Undo buffer

**New file:** `packages/tui-ink/src/hooks/useUndoBuffer.ts`

Create a hook that:

- Takes a `text` string and `cursor` number as inputs
- Snapshots `{ text, cursor }` on a debounced timer (800ms after last change)
- Keeps a max of 50 entries in a stack
- Exposes `undo(): { text, cursor } | undefined` that pops and returns the previous state
- Does NOT snapshot on every keystroke — only after pause in typing

```ts
// Rough shape (adapt to OpenCode conventions):
export function useUndoBuffer(text: string, cursor: number) {
  // refs: stack (Array<{text, cursor}>), timer (ReturnType<typeof setTimeout>)
  // on text/cursor change: clear timer, set new timer to push snapshot
  // undo(): pop stack, return previous entry
  return { undo }
}
```

**Wire into `useTextInput.ts`:**

- Import and call `useUndoBuffer(text, cursor)`
- Add Ctrl+Z / Ctrl+\_ handler: call `undo()`, if result exists set text + cursor

### M1b — External editor (Ctrl+G)

**Add to `Composer.tsx`:**

When Ctrl+G is pressed:

1. Write current input text to a temp file (`Bun.file`)
2. Spawn `$EDITOR` (or `$VISUAL`, fallback to `vi`) with the temp file
3. On process exit, read the file back and replace input text
4. Clean up temp file

CC does this in `promptEditor.ts` (53 lines). Adapt for Bun:

- Use `Bun.spawn` instead of Node's `child_process`
- Must handle raw mode: exit raw mode before spawning editor, re-enter after
- Use `process.env.EDITOR || process.env.VISUAL || "vi"`

**Wire into Composer:** Add to the keybinding handler in `Composer.tsx` alongside
existing Ctrl shortcuts (Ctrl+X stash, Ctrl+Y pop, etc.).

### M1c — Reverse history search (Ctrl+R)

**New file:** `packages/tui-ink/src/hooks/useHistorySearch.ts`

Create a hook that:

- Takes the prompt history array from the store
- Manages a search query string and filtered results
- On each keystroke, filters history entries containing the query (case-insensitive)
- Returns the best match (most recent matching entry)
- Exposes `{ active, query, match, start, cancel, accept, handleInput }`

**UI integration in `Composer.tsx`:**

- When `active`, replace the normal input display with a search prompt:
  `(reverse-i-search)'query': match_preview`
- Ctrl+R again cycles to next match
- Enter/Ctrl+J accepts the match into the input
- Escape/Ctrl+G cancels and restores previous input
- Any non-search key accepts and passes through

### Verify

1. Type some text, wait 1 second, type more. Ctrl+Z should restore to the first version.
2. Set `$EDITOR=nano`, press Ctrl+G — nano should open with current input. Edit, save, quit — input should update.
3. Submit several prompts. Press Ctrl+R, type a substring — matching history entry should appear. Enter to accept.

---

## M2: Pager Mode Keys

**Why:** When scrolled up (detached from bottom), BetterCode only supports arrow keys
and Page Up/Down. CC supports vim-style pager keys: `g`/`G` (top/bottom), `j`/`k`
(line), `Ctrl+U`/`Ctrl+D` (half page), `Ctrl+B`/`Ctrl+F` (full page), `space`
(page down), `b` (page up), `q` (return to bottom).

**CC reference:** `src/components/ScrollKeybindingHandler.tsx` lines 176-312

**Files:** `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/store.ts`

### Implementation

In `MessageList.tsx`, within the `useInput` handler that runs when `scrolledUp` is true,
add additional key cases:

```ts
// Only active when scrolledUp === true (detached from bottom)
if (key === "g" && !shift && !ctrl) scrollTo(0) // top
if (key === "g" && shift) scrollTo(maxOffset) // bottom (Shift+G / G)
if (key === "j") scrollBy(1) // down 1 line
if (key === "k") scrollBy(-1) // up 1 line
if (ctrl && key === "d") scrollBy(halfPage) // half page down
if (ctrl && key === "u") scrollBy(-halfPage) // half page up
if (ctrl && key === "f") scrollBy(fullPage) // full page down
if (ctrl && key === "b") scrollBy(-fullPage) // full page up
if (key === " ") scrollBy(fullPage) // space = page down
if (key === "q") scrollToBottom() // return to bottom
```

Where `halfPage = Math.floor(rows / 2)` and `fullPage = rows - 2` (leave 2 lines context).

**Important:** These single-letter keys (`g`, `j`, `k`, `q`, space) must ONLY be active
when `scrolledUp` is true, otherwise they'd conflict with normal typing. The existing
`useInput` in MessageList already has this guard.

### Verify

1. Scroll up with mouse or Page Up.
2. Press `j`/`k` — should scroll 1 line at a time.
3. Press `Ctrl+D`/`Ctrl+U` — half page jumps.
4. Press `G` — jump to bottom. Press `g` — jump to top.
5. Press `q` — return to bottom and re-attach sticky scroll.

---

## M3: Token & Context Warning

**Why:** Users have no visibility into context window usage. CC shows a warning bar
when context is running low ("Context low — X% remaining") with a unicode progress bar
and suggests `/compact` to free space.

**CC reference:** `src/components/TokenWarning.tsx` (179 lines),
`src/components/design-system/ProgressBar.tsx` (86 lines)

**Files:**

- New: `packages/tui-ink/src/components/TokenWarning.tsx`
- Modified: `packages/tui-ink/src/components/StatusBar.tsx`
- Modified: `packages/tui-ink/src/store.ts`

### Step 1 — Store: track token usage

Add to the store a selector or derived value that computes context usage from the
current session's messages. The backend already provides token counts in message
metadata — expose a `contextUsage` selector:

```ts
// In store.ts, add a selector:
contextUsage: (sessionID: string) => {
  // Compute from messages/parts token counts
  // Return { used: number, max: number, percent: number }
}
```

If the backend doesn't currently expose token counts, add a placeholder that returns
`undefined` and fill it in when the data becomes available.

### Step 2 — ProgressBar utility

Create a simple unicode progress bar function (not a component — just a string builder):

```ts
const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"]

export function progressBar(ratio: number, width: number): string {
  const filled = ratio * width
  const full = Math.floor(filled)
  const partial = Math.round((filled - full) * 8)
  return "█".repeat(full) + (partial > 0 ? BLOCKS[partial] : "") + " ".repeat(width - full - (partial > 0 ? 1 : 0))
}
```

### Step 3 — TokenWarning component

Show a warning when context usage > 75%:

```tsx
export function TokenWarning({ usage }: { usage: { used: number; max: number; percent: number } }) {
  if (usage.percent < 75) return null
  const color = usage.percent > 90 ? "red" : "yellow"
  return (
    <Box>
      <Text color={color}>
        Context {usage.percent > 90 ? "critical" : "low"} — {Math.round(100 - usage.percent)}% remaining [
        {progressBar(usage.percent / 100, 20)}]{usage.percent > 85 ? " Use /compact to free space" : ""}
      </Text>
    </Box>
  )
}
```

### Step 4 — Integrate into StatusBar or SessionScreen

Render `<TokenWarning>` above the StatusBar (or as part of it), visible only when
the threshold is exceeded.

### Verify

1. Accumulate a long conversation. When token usage crosses 75%, the warning should appear.
2. At 90%+ the color should change to red and suggest `/compact`.
3. The progress bar should render with sub-character precision.

---

## M4: Rich Spinner

**Why:** BetterCode's `Spinner.tsx` is 29 lines with basic rotating braille frames.
CC's spinner (562 lines) has shimmer animation on the status text, stall detection
(turns red after 3s with no new tokens), and thinking timer display with minimum
duration (2s so it doesn't flash).

**CC reference:** `src/components/Spinner.tsx` (562 lines)

**File:** `packages/tui-ink/src/components/Spinner.tsx`

### Step 1 — Shimmer effect

Add an animated color sweep across the label text. The shimmer moves a highlight
window across characters using HSL hue cycling or a dim→bright→dim gradient:

```ts
function shimmer(text: string, tick: number): React.ReactNode[] {
  // For each character, compute brightness based on distance from (tick % text.length)
  // Return array of <Text> elements with varying dimColor/bold
  return [...text].map((ch, i) => {
    const dist = Math.abs((tick % text.length) - i)
    const bright = dist <= 2
    return <Text key={i} bold={bright} dimColor={!bright}>{ch}</Text>
  })
}
```

Use a `useEffect` interval (100ms) to increment the tick counter.

### Step 2 — Stall detection

Track when the last token was received. If >3 seconds since last token during
generation, change the spinner color to red/yellow to indicate a stall:

```ts
const stalled = useAppStore((s) => {
  // Check if generating and last token timestamp > 3s ago
  // Return boolean
})
```

Render with `color="red"` when stalled, default color otherwise.

### Step 3 — Thinking timer

When the model is "thinking" (generating but no tool running), show elapsed time
with a minimum display duration of 2 seconds to avoid flashing:

```ts
// Show "Thinking... (3.2s)" with minimum 2s display
const elapsed = useRef(0)
// Track with interval, only show if > 2s
```

### Verify

1. During generation, the spinner label should have a shimmer sweep animation.
2. If the model stalls for >3s with no output, the spinner should turn red.
3. The thinking timer should show elapsed seconds and not flash away instantly.

Completed 2026-04-15:
- Added shimmer sweep + timed/stalled spinner behavior in `packages/tui-ink/src/components/Spinner.tsx`.
- Wired the header to detect thinking vs. running-tool phases and fall back to generic thinking text when no tool is active.
- Validation from `packages/tui-ink`: `bun typecheck` ✅, `bun test test/` ✅.

---

## M5: Unseen Messages

**Why:** When a user scrolls up during generation, new messages arrive below the
viewport. CC shows a "N new messages" divider at the point where the user scrolled
away, plus a floating pill/indicator to jump back to the bottom.

**CC reference:** `src/components/VirtualMessageList.tsx` lines 297-340

**Files:** `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/store.ts`

### Step 1 — Track the "last seen" message index

In the store, add:

```ts
lastSeen: Record<string, number>  // sessionID → message index when user scrolled up
setLastSeen: (sessionID: string, index: number) => void
```

When the user scrolls up (transitions from `scrolledUp=false` to `scrolledUp=true`),
snapshot the current message count as `lastSeen`.

### Step 2 — Render the divider

In `MessageList.tsx`, when rendering messages, if the message index equals `lastSeen`
and there are newer messages, render a divider:

```tsx
<Box justifyContent="center">
  <Text color="cyan" bold>
    {" "}
    ── {unseenCount} new message{unseenCount > 1 ? "s" : ""} ──{" "}
  </Text>
</Box>
```

### Step 3 — Jump-to-bottom pill

When `scrolledUp` and there are unseen messages, show a floating indicator at the
bottom of the message list (above the composer):

```tsx
{
  scrolledUp && unseenCount > 0 && (
    <Box justifyContent="center">
      <Text color="cyan" inverse>
        {" "}
        ↓ {unseenCount} new ↓{" "}
      </Text>
    </Box>
  )
}
```

Pressing Enter or `q` or `G` in pager mode should jump to bottom and clear the
unseen count.

### Verify

1. Start generation, scroll up. New messages should arrive but viewport stays put.
2. A "N new messages" divider should appear at the scroll-away point.
3. A pill indicator should show at the bottom. Pressing `G` or scrolling to bottom clears it.

---

## M6: OffscreenFreeze

**Why:** Messages scrolled above the viewport may contain spinners, elapsed time
counters, or other timer-driven content that re-renders every tick. CC wraps offscreen
children in `OffscreenFreeze` to prevent these re-renders — a simple 44-line component
that caches the last rendered output when the child moves offscreen.

**CC reference:** `src/components/OffscreenFreeze.tsx` (44 lines)

**Files:**

- New: `packages/tui-ink/src/components/OffscreenFreeze.tsx`
- Modified: `packages/tui-ink/src/components/MessageList.tsx`

### Implementation

```tsx
// OffscreenFreeze.tsx
import React, { useRef } from "react"

interface Props {
  visible: boolean
  children: React.ReactNode
}

export function OffscreenFreeze({ visible, children }: Props) {
  const cache = useRef<React.ReactNode>(null)
  if (visible) cache.current = children
  return <>{cache.current}</>
}
```

### Integration in MessageList

In the windowed rendering loop in `MessageList.tsx`, wrap each message item:

```tsx
<OffscreenFreeze visible={isInViewport}>
  <MessageItem ... />
</OffscreenFreeze>
```

Where `isInViewport` is true when the message index falls within the current
window range (already computed by the existing windowing logic).

### Verify

1. Start a generation that produces many tool calls with spinners.
2. Scroll up so some spinning tool calls are offscreen.
3. Use React DevTools or add a render counter — offscreen items should NOT re-render.

Completed 2026-04-15:
- Added `packages/tui-ink/src/components/OffscreenFreeze.tsx` with cached offscreen child rendering that preserves the first buffered frame and freezes later updates while hidden.
- Updated `packages/tui-ink/src/components/MessageList.tsx` to share viewport/window math via `findWindow()` and wrap buffered rows with `OffscreenFreeze` only when they are outside the real viewport.
- Added focused coverage in `packages/tui-ink/test/offscreen-freeze.test.tsx` and `packages/tui-ink/test/scroll.test.ts`.
- Validation from `packages/tui-ink`: `bun typecheck` ✅, `bun test test/` ✅.

---

## M7: Text Selection & Copy

**Why:** Terminal users expect to select text and copy it. BetterCode has no text
selection support. CC implements full mouse-drag text selection with copy-on-release,
Ctrl+C/Ctrl+Shift+C to copy, shift+arrow keyboard selection, and clipboard path
detection (native pbcopy/xclip, tmux, OSC52 fallback).

**CC reference:** `src/components/ScrollKeybindingHandler.tsx` lines 400-700

**Files:**

- New: `packages/tui-ink/src/hooks/useTextSelection.ts`
- New: `packages/tui-ink/src/utils/clipboard.ts`
- Modified: `packages/tui-ink/src/components/MessageList.tsx`

### Step 1 — Clipboard utility

```ts
// clipboard.ts
export async function copy(text: string) {
  // Detect environment and use best available method:
  // 1. macOS: pbcopy
  // 2. Linux X11: xclip -selection clipboard
  // 3. Linux Wayland: wl-copy
  // 4. tmux: tmux load-buffer -
  // 5. Fallback: OSC52 escape sequence (\x1b]52;c;BASE64\x07)
  if (process.platform === "darwin") {
    const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" })
    proc.stdin.write(text)
    proc.stdin.end()
    await proc.exited
    return
  }
  // ... other platforms, fallback to OSC52
  process.stdout.write(`\x1b]52;c;${btoa(text)}\x07`)
}
```

### Step 2 — Selection hook

Track selection state: `start` position, `end` position, `active` boolean.
On mouse down, record start. On mouse move with button held, update end.
On mouse up, compute selected text from the rendered content and copy.

This is complex because terminal coordinates must be mapped back to content
positions. Start with a simplified approach:

- Track screen-space row/col coordinates
- Extract text from the rendered buffer between start and end positions
- Use ANSI-aware string slicing

### Step 3 — Visual highlight

When selection is active, re-render selected text with inverse video:

```tsx
<Text inverse>{selectedText}</Text>
```

### Step 4 — Keyboard shortcut

- Ctrl+Shift+C: copy current selection (if any)
- When scrolled up, Ctrl+C should copy instead of interrupt (CC behavior)

### Verify

1. Click and drag across text in a message — text should highlight with inverse video.
2. Release mouse — text should be copied to clipboard.
3. Ctrl+Shift+C should also copy the selection.
4. Verify on macOS (pbcopy), Linux (xclip), and tmux.

---

## M8: Message Actions

**Why:** CC lets users navigate between messages with Shift+Up/Down, copy a specific
message's content, and edit/resubmit user messages. BetterCode has no per-message
cursor or actions.

**CC reference:** `src/components/messageActions.tsx`

**Files:**

- New: `packages/tui-ink/src/components/MessageActions.tsx`
- Modified: `packages/tui-ink/src/components/MessageList.tsx`
- Modified: `packages/tui-ink/src/store.ts`
- Modified: `packages/tui-ink/src/components/Composer.tsx`

### Step 1 — Message cursor in store

```ts
// In store.ts, add:
messageCursor: Record<string, number | null>  // sessionID → message index or null
setMessageCursor: (sessionID: string, index: number | null) => void
```

### Step 2 — Shift+Up/Down navigation

In `MessageList.tsx`, handle Shift+Up/Down when not in input mode:

- Shift+Up: move cursor to previous message (skip tool-result messages)
- Shift+Down: move cursor to next message
- Escape: clear cursor

When a message is "cursored", render it with a left border highlight:

```tsx
<Box borderStyle="single" borderLeft borderColor="cyan">
  <MessageItem ... />
</Box>
```

### Step 3 — Copy message action

When a message is cursored, pressing `c` or Ctrl+Shift+C copies its text content
to clipboard using the `clipboard.ts` utility from M7.

### Step 4 — Edit/resubmit user message

When a user message is cursored, pressing `e` should:

1. Copy the message text into the composer
2. Scroll to bottom
3. Clear the cursor
4. Let the user edit and resubmit

This effectively creates a "resubmit with edits" workflow. The original message
and all subsequent messages remain in the transcript — the edited version is
submitted as a new prompt.

### Verify

1. Press Shift+Up/Down — a visual cursor should move between messages.
2. With cursor on a message, press `c` — message content should be in clipboard.
3. With cursor on a user message, press `e` — text should appear in composer for editing.

Completed 2026-04-15:
- Added per-session `messageCursor` state in `store.ts`, plus a small composer seeding path so edit/resubmit can replace the current draft without losing it.
- Added `packages/tui-ink/src/components/MessageActions.tsx` with pure helpers for cursor movement, visibility snapping, and message copy/edit text extraction.
- Updated `MessageList.tsx` so Shift+Up/Down walks messages, `Esc` clears the cursor, `c` copies the selected message, and `e` loads selected user text back into the composer and snaps to bottom.
- Updated `UserMessage.tsx` and `AssistantMessage.tsx` to render a distinct cursor highlight without changing transcript layout.
- M7 pre-smoke completed in a live terminal before implementation: mouse selection + copy produced the in-app copied toast and the expected `pbpaste` result.
- Validation from `packages/tui-ink`: `bun typecheck` ✅, `bun test test/` ✅.

---

## M9: True Virtual Scrolling

**Why:** BetterCode's `MessageList.tsx` uses basic windowed rendering with `WIN_BUFFER=2`.
It renders all messages and slices to a window, but still mounts React components for
items outside the window during height estimation. CC has a true virtualization system
that only mounts items in viewport + overscan (80 rows), uses Float64Array offset
caching, binary search for visible range, scroll quantization (SCROLL_QUANTUM=40) to
batch wheel events, and `useDeferredValue` for time-slicing fresh mounts.

**CC reference:**

- `src/hooks/useVirtualScroll.ts` (721 lines)
- `src/components/VirtualMessageList.tsx` (1082 lines)

**Files:**

- New: `packages/tui-ink/src/hooks/useVirtualScroll.ts`
- Major rewrite: `packages/tui-ink/src/components/MessageList.tsx`

### This is the largest milestone. Break into sub-steps:

### Step 1 — Height cache with Float64Array

```ts
// Cumulative offset array for O(1) position lookups
const offsets = new Float64Array(capacity)
// offsets[i] = sum of heights 0..i-1
// Binary search to find first visible item given scrollTop
```

Use a PESSIMISTIC_HEIGHT (1 row) for unmeasured items. After measurement, update
the cache and recompute offsets.

### Step 2 — Binary search for visible range

Given a `scrollTop` value, binary search `offsets` to find the first item whose
cumulative offset is >= scrollTop. The visible range is from that item to the
item whose offset exceeds scrollTop + viewportHeight.

### Step 3 — Overscan

Only mount items in `[firstVisible - overscan, lastVisible + overscan]`.
CC uses overscan of 80 rows (not 80 items). Convert overscan from rows to items
using estimated heights.

### Step 4 — Scroll quantization

Instead of processing every wheel event, quantize scroll position to multiples
of SCROLL_QUANTUM (40 pixels/rows). This reduces React re-renders during fast
scrolling:

```ts
const quantized = Math.round(raw / SCROLL_QUANTUM) * SCROLL_QUANTUM
```

### Step 5 — Deferred mounting

Use `React.useDeferredValue` to time-slice mounting of newly visible items:

```ts
const deferred = React.useDeferredValue(visibleRange)
```

This prevents janky scrolling when many new items enter the viewport at once.

### Step 6 — Slide-step cap

Cap the maximum number of items that can enter the viewport per commit to 25.
If the user scrolls very far very fast, intermediate positions are skipped to
maintain responsiveness.

### Verify

1. Load a transcript with 500+ messages. Scrolling should remain smooth.
2. Only items in the viewport + overscan should be mounted (verify with render counters).
3. Fast scroll (mouse wheel spam) should not cause frame drops.
4. Height measurements should stabilize after first render (no layout jumps).

---

## M10: Configurable Keybindings

**Why:** BetterCode hardcodes all keybindings. CC has a full keybinding system with
14 contexts, 80+ actions, and user-overridable via `keybindings.json`. Power users
expect to customize their keybindings.

**CC reference:** `src/keybindings/` (14 files), especially:

- `schema.ts` — context and action definitions
- `defaultBindings.ts` — default keybinding map
- `resolve.ts` — context-based resolution

**Files:**

- New: `packages/tui-ink/src/keybindings/schema.ts`
- New: `packages/tui-ink/src/keybindings/defaults.ts`
- New: `packages/tui-ink/src/keybindings/resolve.ts`
- New: `packages/tui-ink/src/keybindings/index.ts`
- Modified: `packages/tui-ink/src/store.ts`

### Step 1 — Define contexts and actions

```ts
// schema.ts
export type Context =
  | "global" // always active
  | "chat" // when composer is focused
  | "scroll" // when scrolled up (detached)
  | "search" // when search bar is open
  | "dialog" // when a dialog is open
  | "sidebar" // when sidebar is open

export type Action =
  | "submit"
  | "newline"
  | "scrollUp"
  | "scrollDown"
  | "scrollPageUp"
  | "scrollPageDown"
  | "scrollTop"
  | "scrollBottom"
  | "toggleFocus"
  | "search"
  | "cancel"
  | "undo"
  | "stash"
  | "unstash"
  | "historyPrev"
  | "historyNext"
  | "historySearch"
  | "externalEditor"
  | "quit"
// ... etc.
```

### Step 2 — Default bindings

```ts
// defaults.ts
export const defaults: Record<Action, { key: string; context: Context }[]> = {
  submit: [{ key: "return", context: "chat" }],
  scrollUp: [
    { key: "up", context: "scroll" },
    { key: "k", context: "scroll" },
  ],
  // ...
}
```

### Step 3 — User overrides

Load from `~/.config/opencode/keybindings.json` (or the project config directory).
Merge with defaults, user values take precedence.

### Step 4 — Resolution hook

```ts
// resolve.ts
export function useKeybinding(action: Action): string[] {
  // Returns the key sequences bound to this action in the current context
}

export function resolveAction(key: string, context: Context): Action | undefined {
  // Given a key press and current context, return the matching action
}
```

### Step 5 — Migrate existing hardcoded bindings

Replace all hardcoded key checks across `MessageList.tsx`, `Composer.tsx`,
`SessionScreen.tsx`, etc. with calls to `resolveAction()`.

### Verify

1. All existing keybindings should work exactly as before with no config file.
2. Create a `keybindings.json` that remaps `scrollUp` to `ctrl+p`. Verify it works.
3. Invalid or unknown actions in the config file should be silently ignored.

Completed 2026-04-16:
- Added `packages/tui-ink/src/keybindings/` with a typed context/action schema, default bindings, input normalization, display formatting, resolution helpers, and JSON override loading.
- Wired keybindings into TUI bootstrap via `readKeybindings()`, loading global `~/.config/opencode/keybindings.json` first and then `OPENCODE_CONFIG_DIR/keybindings.json` as a project override when present.
- Stored the merged binding map in `useAppStore`, then migrated the main shortcut owners to `resolveAction()`: `app.tsx`, `SessionScreen.tsx`, `Composer.tsx`, `MessageList.tsx`, `SearchBar.tsx`, `HomeScreen.tsx`, and `HelpDialog.tsx`.
- Updated visible shortcut labels to reflect configured bindings in host commands, status/search/help text, diff hints, and scroll indicators so overrides stay discoverable.
- Added focused tests in `packages/tui-ink/test/keybindings.test.ts` and updated pager tests to run through the new resolver path.
- Validation from `packages/tui-ink`: `bun typecheck` ✅, `bun test test/` ✅.

---

## M11: Design System Primitives

**Why:** CC has 16 reusable components in `design-system/` that enforce consistent
styling: Pane, Dialog, FuzzyPicker, ProgressBar, ListItem, Divider, KeyboardShortcutHint,
Tabs, ThemedBox, StatusIcon, etc. BetterCode rebuilds these patterns ad-hoc in each
component.

**CC reference:** `src/components/design-system/` — Dialog.tsx (138 lines),
FuzzyPicker.tsx (312 lines), Pane.tsx (77 lines), ProgressBar.tsx (86 lines)

**Files:** New `packages/tui-ink/src/components/design-system/` directory

### Components to create (priority order)

**1. Pane** — Bordered box with title, consistent padding, theme colors:

```tsx
<Pane title="Session History" width={40}>
  {children}
</Pane>
```

**2. Dialog** — Modal overlay with title, body, action buttons, Escape to close:

```tsx
<Dialog title="Confirm" onClose={close}>
  <Text>Are you sure?</Text>
  <DialogActions>
    <Action label="Yes" onSelect={confirm} />
    <Action label="No" onSelect={close} />
  </DialogActions>
</Dialog>
```

**3. Divider** — Horizontal rule with optional centered label:

```tsx
<Divider label="3 new messages" color="cyan" />
```

**4. ProgressBar** — Unicode block-element progress bar (from M3):

```tsx
<ProgressBar ratio={0.73} width={20} color="green" />
```

**5. KeyboardShortcutHint** — Styled key hint display:

```tsx
<KeyboardShortcutHint keys={["Ctrl", "F"]} label="Search" />
```

**6. ListItem** — Selectable list item with icon, label, description:

```tsx
<ListItem icon="●" label="main" description="default branch" selected={true} />
```

**7. FuzzyPicker** — Filterable list with fuzzy search input (useful for
session picker, file picker, command palette). This is the most complex one
and can be deferred to a later milestone if needed.

### Migration

After creating primitives, refactor existing components to use them:

- `Sidebar.tsx` → use `Pane` and `ListItem`
- Permission dialogs → use `Dialog`
- `StatusBar.tsx` hint display → use `KeyboardShortcutHint`
- Unseen messages (M5) → use `Divider`

### Verify

1. Each primitive should render correctly in isolation.
2. Refactored components should look identical to before.
3. `bun typecheck` and `bun test test/` pass.

Completed 2026-04-16:
- Added `packages/tui-ink/src/components/design-system/` primitives for `Pane`, `Dialog`, `FuzzyPicker`, `ProgressBar`, `ListItem`, `Divider`, and `KeyboardShortcutHint`, plus shared exports.
- Migrated the text-first picker/dialog surfaces onto the new primitives: `CommandPalette.tsx`, `ModelPickerDialog.tsx`, `AgentPickerDialog.tsx`, `ThemePickerDialog.tsx`, `HelpDialog.tsx`, and the dock alert pane.
- Reused the shared `ProgressBar` utility in `TokenWarning.tsx`, moved status hint rendering onto `KeyboardShortcutHint`, and replaced the unseen-message separator in `MessageList.tsx` with `Divider`.
- Kept state-heavy permission/question/sidebar flows stable for this milestone instead of widening the refactor beyond the required dialog/picker path.
- Validation from `packages/tui-ink`: `bun typecheck` ✅, `bun test test/` ✅.

---

## M12: Vim Mode

**Why:** Many developer tools support vim keybindings. CC has a full vim mode in the
composer with normal/insert mode, motions (h/l/j/k/w/b/e/W/B/E/0/^/$), operators
(d/c/y), text objects (iw/aw/i"/a"/i(/a(etc.), dot-repeat, find (f/F/t/T), and registers.

**CC reference:** `src/vim/` (5 files: types.ts, motions.ts, operators.ts,
textObjects.ts, transitions.ts — ~199 lines for types alone)

**Files:**

- New: `packages/tui-ink/src/vim/types.ts`
- New: `packages/tui-ink/src/vim/motions.ts`
- New: `packages/tui-ink/src/vim/operators.ts`
- New: `packages/tui-ink/src/vim/objects.ts`
- New: `packages/tui-ink/src/vim/index.ts`
- Modified: `packages/tui-ink/src/hooks/useTextInput.ts`
- Modified: `packages/tui-ink/src/components/Composer.tsx`

### This is an XL milestone. Sub-steps:

### Step 1 — State machine types

```ts
export type VimMode = "normal" | "insert" | "visual" | "operator-pending"

export interface VimState {
  mode: VimMode
  count: number // numeric prefix (e.g., 3w)
  operator: string | null // pending operator (d, c, y)
  register: string // register for yank/paste
  lastEdit: Edit | null // for dot-repeat
}
```

### Step 2 — Motions

Implement cursor movement functions that take text + cursor and return new cursor:

- Character: h, l
- Word: w, b, e, W, B, E
- Line: j, k, 0, ^, $
- Find: f{char}, F{char}, t{char}, T{char}

Each motion respects the count prefix.

### Step 3 — Operators

Implement delete (d), change (c), yank (y) that combine with motions:

- `dw` = delete word, `d$` = delete to end of line
- `cc` = change entire line, `yy` = yank line
- Operators enter "operator-pending" mode, next motion defines the range

### Step 4 — Text objects

- `iw`/`aw` — inner/around word
- `i"`/`a"`, `i'`/`a'` — inner/around quotes
- `i(`/`a(`, `i{`/`a{`, `i[`/`a[` — inner/around brackets

### Step 5 — Mode transitions

- `i` → insert at cursor, `a` → insert after cursor
- `I` → insert at line start, `A` → insert at line end
- `o` → open line below, `O` → open line above
- `Escape` → back to normal mode
- `v` → visual mode (if implementing visual)

### Step 6 — Dot-repeat

Record the last edit operation (operator + motion/text-object + inserted text).
`.` replays it at the current cursor position.

### Step 7 — Mode indicator in Composer

Show the current vim mode in the composer prompt area:
`-- NORMAL --`, `-- INSERT --`, `-- VISUAL --`

### Step 8 — Config toggle

Vim mode should be opt-in via config: `vim: true` in the OpenCode config file.
Default is standard editing mode.

### Verify

1. Enable vim mode in config. Press `Escape` — should enter normal mode.
2. `w`/`b` should move by word. `dw` should delete a word. `ci"` should change inner quotes.
3. `3j` should move down 3 lines. `.` should repeat the last edit.
4. `i`/`a`/`o` should enter insert mode at the right position.
5. Mode indicator should update in real-time.

---

## M13: Image Paste

**Why:** CC supports pasting images from clipboard via Ctrl+V. Images are rendered as
`[Image #N]` pills in the input and sent as base64 image parts. This is useful for
sharing screenshots, diagrams, or error messages with the model.

**CC reference:** `src/utils/imagePaste.ts`

**Files:**

- New: `packages/tui-ink/src/utils/imagePaste.ts`
- Modified: `packages/tui-ink/src/components/Composer.tsx`
- Modified: `packages/tui-ink/src/hooks/useTextInput.ts`

### Step 1 — Clipboard image detection

```ts
// imagePaste.ts
export async function readClipboardImage(): Promise<{ data: string; mime: string } | null> {
  if (process.platform === "darwin") {
    // Use `osascript` to check if clipboard contains image data
    // Use `pbpaste` or `osascript` to extract image data
    // Return base64-encoded data with mime type
  }
  if (process.platform === "linux") {
    // Use xclip -selection clipboard -t image/png -o
    // Pipe to base64
  }
  return null
}
```

### Step 2 — Image state in Composer

Track attached images in the composer state:

```ts
const [images, setImages] = useState<Array<{ data: string; mime: string }>>([])
```

On Ctrl+V, check for clipboard image first. If found, add to images array.
If no image, fall back to normal text paste.

### Step 3 — Image pill rendering

In the composer input area, render attached images as pills:

```tsx
{
  images.map((img, i) => (
    <Text key={i} color="blue" inverse>
      {" "}
      [Image #{i + 1}]{" "}
    </Text>
  ))
}
```

### Step 4 — Send images with prompt

When submitting, include images as base64 image content parts alongside the
text content. The backend/SDK should already support multi-part messages with
image content.

### Verify

1. Copy an image to clipboard (e.g., screenshot on macOS).
2. Press Ctrl+V in the composer — `[Image #1]` pill should appear.
3. Submit the prompt — the image should be sent to the model.
4. Multiple images should show as `[Image #1]`, `[Image #2]`, etc.

---

## M14: Input Syntax Highlights

**Why:** CC highlights special tokens in the composer input: `/commands` in blue,
`@mentions` in contextual colors, and search terms in yellow. This makes the input
more readable and helps users spot formatting.

**CC reference:** `src/components/PromptInput/PromptInput.tsx` lines 1800-2000
(highlight merging system)

**Files:**

- New: `packages/tui-ink/src/hooks/useHighlights.ts`
- Modified: `packages/tui-ink/src/components/Composer.tsx`

### Step 1 — Highlight computation

```ts
// useHighlights.ts
interface Highlight {
  start: number
  end: number
  color: string
  bold?: boolean
}

export function computeHighlights(text: string): Highlight[] {
  const result: Highlight[] = []

  // Slash commands: /command at start of input
  const slash = text.match(/^(\/\S+)/)
  if (slash) {
    result.push({ start: 0, end: slash[1].length, color: "blue", bold: true })
  }

  // @mentions: @filename or @symbol
  for (const match of text.matchAll(/@(\S+)/g)) {
    result.push({
      start: match.index!,
      end: match.index! + match[0].length,
      color: "cyan",
      bold: true,
    })
  }

  return result
}
```

### Step 2 — Highlighted rendering

In `Composer.tsx`, instead of rendering the input text as a plain string,
split it into segments based on highlights and render each with appropriate
styling:

```tsx
function renderHighlighted(text: string, highlights: Highlight[]): React.ReactNode[] {
  // Sort highlights by start position
  // Split text into segments: plain text between highlights + highlighted spans
  // Return array of <Text> elements with appropriate color/bold props
}
```

### Step 3 — Integration

Replace the raw text rendering in the composer with the highlighted version.
Ensure cursor positioning still works correctly (highlights are purely visual
and don't affect the text buffer or cursor math).

### Verify

1. Type `/help` — should render in blue bold.
2. Type `@README.md` — should render in cyan bold.
3. Type normal text — should render with default styling.
4. Cursor movement and editing should work identically to before.

---

## Dependency Graph

Most milestones are independent, but some have soft dependencies:

```
M1 (Composer Power)  ─── standalone
M2 (Pager Keys)      ─── standalone
M3 (Token Warning)   ─── standalone
M4 (Rich Spinner)    ─── standalone
M5 (Unseen Messages) ─── standalone
M6 (OffscreenFreeze) ─── standalone
M7 (Text Selection)  ─── standalone
M8 (Message Actions) ─── uses M7's clipboard.ts
M9 (Virtual Scroll)  ─── benefits from M6 (OffscreenFreeze)
M10 (Keybindings)    ─── should run after M1, M2, M8 are done (migrates their keys)
M11 (Design System)  ─── can refactor M3, M5 components after
M12 (Vim Mode)       ─── depends on M1 (undo buffer)
M13 (Image Paste)    ─── standalone
M14 (Highlights)     ─── standalone
```

**Recommended execution order:** M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10 → M11 → M12 → M13 → M14

This order front-loads the high-value, lower-risk milestones and saves the
larger refactors (virtual scroll, keybindings, vim) for later when the
foundation is more stable.

## Latest Handoff Prompt

```text
Continue the TUI milestone plan in /Users/bhaskar.melkani/Documents/Projects/bhaskar/bettercode/plans/cc-beco-2.md.

Context:
- Repo: /Users/bhaskar.melkani/Documents/Projects/bhaskar/bettercode
- Active plan: /Users/bhaskar.melkani/Documents/Projects/bhaskar/bettercode/plans/cc-beco-2.md
- Completed milestones: M1 Composer Editing Power, M2 Pager Mode Keys, M3 Token & Context Warning, M4 Rich Spinner, M5 Unseen Messages, M6 OffscreenFreeze, M7 Text Selection & Copy, M8 Message Actions, M9 True Virtual Scrolling, M10 Configurable Keybindings, M11 Design System Primitives
- Next milestone to implement: M12 Vim Mode

Execution rules:
- Implement one milestone only.
- Do not start M13 until M12 is stable and green.
- Keep the implementation Ink-native and avoid unnecessary abstractions or broad rewrites.
- Be careful around transcript stability, sticky/detached scroll, permission/question flows, session switching, and long transcripts.
- Work around unrelated local edits; do not revert them.

Required first step:
- Read the active plan and inspect `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/components/Composer.tsx`, and any existing mode/key handling before editing.

Required validation:
- Run from /Users/bhaskar.melkani/Documents/Projects/bhaskar/bettercode/packages/tui-ink only:
  - bun typecheck
  - bun test test/

Before stopping:
- Mark M12 complete in /Users/bhaskar.melkani/Documents/Projects/bhaskar/bettercode/plans/cc-beco-2.md if it is green.
- End with a compact handoff prompt for the next session.
```
