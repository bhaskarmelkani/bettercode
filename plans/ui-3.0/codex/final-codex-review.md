# BetterCode TUI: Final Research & Implementation Specification

**Date:** 2026-04-14
**Scope:** UX audit, architecture review, performance analysis, implementation roadmap
**Repo:** bettercode (Ink-based TUI over OpenCode backend)

---

# 1. Executive Summary

BetterCode has the right strategic shape: a dedicated `bettercode` entrypoint launches the OpenCode backend, then hands off to a separate Ink-based TUI. The delta batching (50ms flush in `hooks/useSDK.ts`), binary-search sorted arrays (`bsearch()` in `store.ts`), session-scoped selectors, and 7-theme system are solid foundations. BetterCode does not need reinvention. It needs disciplined refinement.

**The three biggest UX problems:**

1. **The composer is functionally broken.** No cursor position state exists in `Composer.tsx`. Characters append to the end only (`value + input` at line 339). Backspace deletes from the end only (`value.slice(0, -1)` at line 317). No left/right arrow handling. No Ctrl+A/E. No word deletion. No multi-line input. This is unacceptable for a coding tool and is the single most user-facing deficiency.

2. **The transcript is flat and noisy.** User messages, assistant text, and tool calls all have near-identical visual weight. `UserMessage.tsx:29` uses `borderColor={theme.cyan}`, `AssistantMessage.tsx:55` uses `borderColor={theme.surface2}` — the difference is too subtle to scan. Tool calls show raw JSON input during execution (`ToolPart.tsx:73` keeps tools open while running) and collapse after completion (hiding the useful output). This is exactly backwards.

3. **Rendering degrades with conversation length.** `MessageList.tsx:144-147` computes `totalHeight` via `marked.lexer` on every text part of every message on each 50ms delta flush — O(n × text_length) per frame. No message virtualization. No `React.memo` on UserMessage/AssistantMessage/ToolPart. `useSessionParts` (lines 103-111) creates a new object reference on every delta, defeating memo for all children.

**The three biggest implementation risks:**

1. **Monolithic store** — 631 lines, 49 fields, 42 actions. Every `set()` notifies all subscribers. 14 `useAppStore()` calls in SessionScreen alone. During streaming, `appendPartDelta` triggers evaluation of all 14 selectors at 20Hz.

2. **Composer.tsx at 443 lines** — mixes text editing, menu state (slash + @mention), animation timers (spinner, caret), server-append handling, file attachments, and rendering in one component.

3. **Type casts everywhere** — `(sess as any).parentID` in SessionScreen:46, `(p as any).synthetic` in UserMessage:15, `(msg as Message & {...})` in AssistantMessage:34-41. SDK types don't match runtime data.

**Top opportunity:** Make BetterCode feel like a quiet, trustworthy workbench. Fix composer cursor support, implement a 3-weight visual hierarchy, invert tool disclosure defaults, cache completed message heights, and memoize message components. These five changes transform the product from "capable prototype" to "daily driver."

---

# 2. Repo Structure

## Entry & Bootstrap

| File | Role |
|------|------|
| `packages/opencode/bin/bettercode` | Shell shim: detects dev vs prod, spawns TUI |
| `packages/opencode/src/cli/cmd/bettercode.ts` | Yargs command: starts Server, spawns TUI with env vars |
| `packages/tui-ink/src/index.tsx` | TUI entry: loads prefs, inits store, renders `<App />`, handles SIGINT |

## Core Architecture

| File | Lines | Role |
|------|-------|------|
| `src/app.tsx` | 112 | Root: screen routing, global keys, dialog classification, responsive layout |
| `src/store.ts` | 631 | Zustand: 49 fields + 42 actions + bsearch helper |
| `src/hooks/useSDK.ts` | 281 | Bootstrap (9 parallel fetches) + SSE streaming + delta batching (50ms) |
| `src/theme.ts` | 165 | 7 themes × 17 semantic color slots |

## Session Screen Composition

| File | Lines | Role |
|------|-------|------|
| `screens/SessionScreen.tsx` | 143 | Header + MessageList + ToastOverlay + BottomDock + Sidebar + StatusBar |
| `components/MessageList.tsx` | 268 | Scrollable list: height estimation, sticky scroll, keyboard/mouse scroll |
| `components/Composer.tsx` | 443 | Input: text editing (append-only), history, stash, @mentions, /commands, spinner |
| `components/BottomDock.tsx` | 101 | Routes between panel dialogs and permissions/questions + Composer |

## Message Rendering Pipeline

| File | Lines | Role |
|------|-------|------|
| `components/UserMessage.tsx` | 47 | Cyan left border + markdown text + file badges. NOT memoized |
| `components/AssistantMessage.tsx` | 104 | Part dispatcher: Text/Reasoning/Tool/Compaction. Footer. NOT memoized |
| `components/parts/ToolPart.tsx` | 115 | 4 status states × 6 kind icons. Collapsible. Shows JSON input when running |
| `components/markdown/MarkdownRenderer.tsx` | 143 | GFM parser via `marked` lexer. Code blocks, lists, inline formatting |

## Dead Code

| File | Status |
|------|--------|
| `components/InputBar.tsx` | Exists but not wired into live flow |
| `components/ChatPane.tsx` | Exists but not wired into live flow |
| `components/ContextPane.tsx` | Exists but not wired into live flow |
| `components/Sidebar.tsx` | `active={false}` hardcoded at SessionScreen:137 |

## Connection Architecture

```
bettercode CLI
  ↓ spawns server + TUI child process

OpenCode Server (Hono)
  ├── REST API (sessions, messages, providers, agents, config)
  └── SSE endpoint (/event) with 10s heartbeat

TUI (Ink + React + Zustand)
  ├── useSDK: bootstrap (9 parallel fetches) + SSE streaming
  ├── Delta batching: 50ms buffer → flush → store.appendPartDelta
  └── Store → React reconciliation → Ink terminal render
```

---

# 3. Design Principles

These principles are specific to BetterCode's context: an Ink-based TUI for long coding-agent sessions, rendered in constrained terminal environments, driven entirely by keyboard.

## 3.1 Transcript first, chrome second

The message thread is the primary artifact. Header, status, sidebar, and dock exist to support the conversation, not compete with it. Claude Code uses almost zero chrome — no borders around messages, no boxes around tool calls. Just indentation, color weight, and whitespace. The result reads like a clean conversation.

**BetterCode application:** Currently Header (`Box height={1}` with inline text, no background) and StatusBar (same) blend into content. Add `backgroundColor={theme.mantle}` to both to create a visual "window frame" that anchors the eye without adding borders.

## 3.2 Three visual weights

Bold/bright for user input and active prompt. Normal for assistant text. Dim for tool calls, metadata, timestamps, token counts. This single principle transforms scanability with zero architecture cost.

**BetterCode application:** Currently `UserMessage` (cyan border) and `AssistantMessage` (surface2 border) are too similar. Tool calls use `color={theme[stat.color]}` — same weight as text. Fix: user messages bold with cyan, assistant text normal weight, tool calls `color={theme.subtext}` or `dimColor`.

## 3.3 Progressive disclosure for tool output

Show minimum information at each level. Default to collapsed; expand on interaction. A single agent turn can involve 5-20 tool calls. If each shows full output, the conversation becomes unreadable.

**BetterCode application:** `ToolPart.tsx:73` has `const open = state.status !== "completed" || collapsed === false` — this keeps tools OPEN while running/pending (showing JSON input via `json(state.input)`) and collapses after completion. This is backwards. Fix: show one-line status during execution ("reading src/store.ts..."), keep completed tools collapsed with semantic summary ("Read src/store.ts - 142 lines"), expand errors automatically.

## 3.4 Stable regions during streaming

The viewport needs fixed reference points — header, footer, input area — that don't move during streaming. Currently `marginTop={absoluteTop}` in MessageList (line 247) shifts content on every scroll update. During streaming, height re-estimation causes `absoluteTop` to change every 50ms flush.

**BetterCode application:** Fix dock height to be stable. Keep header/statusbar fixed. Only the message content area scrolls. The `dockHeight()` function in `BottomDock.tsx` returns different heights based on permissions/questions — when a permission arrives mid-stream, the dock jumps from 4 to 9 rows. This needs to be stabilized.

## 3.5 One primary focus at a time

At any moment, the user should have exactly one primary interaction point. vim has one active window. lazygit highlights the active panel and dims inactive ones.

**BetterCode application:** During generation, the spinner in the composer and streaming text in MessageList compete for attention. The user's primary focus during generation should be the streaming output, with the composer receding to a minimal "generating..." indicator. Currently both header and composer show generation spinners — pick one.

## 3.6 Keyboard-first discoverability

Available actions should be visible in context. StatusBar currently shows two hardcoded hint strings (`StatusBar.tsx:16`) — one for generating, one for idle. No adaptation for dialog open, permission pending, scrolled up, or sidebar focused.

**BetterCode application:** Make hints fully context-sensitive. Show focus-relevant keys only. Offer explicit help surface (Ctrl+?) for full shortcuts. Note: Ctrl+K conflicts with "kill to end of line" in most terminals; Ctrl+S conflicts with XON/XOFF. Audit against common terminal emulator defaults.

## 3.7 Dense but scannable

Every row should carry information. UserMessage currently has 4+ rows of overhead for 1-line input: marginTop + border + paddingLeft=2 + nested Box + text. Three levels of Box nesting. Flatten to: `<Box marginTop={1} borderLeft borderColor={cyan}><Text>• {text}</Text></Box>`.

## 3.8 Never require color to read state

Terminal themes vary. SSH, tmux, and reduced-color environments are common. Every state (success, warning, error, running) needs a text label or icon cue, not just color. Currently the UI leans heavily on colored icons and pills without fallback.

## 3.9 The composer must be editor-grade

Terminal users expect readline keybindings: Ctrl+A/E, Ctrl+W, cursor movement, history. Claude Code, Aider, and Codex CLI all support these. BetterCode's composer has none of them — it's append-only. This is the single most impactful UX deficiency.

## 3.10 Optimize the hot path before generalizing

Fix transcript rendering, tool disclosure, and composer before extracting shared dialog primitives. The dialogs work fine — they're slightly redundant in code but users don't care. Shared primitives are Phase 3 work.

---

# 4. Detailed Audit

## 4.1 Composer (Severity: Critical)

**Problem:** No cursor position state. Append-only input. No multi-line support.

**Code evidence:**
- `Composer.tsx:339`: `value + input` — characters appended at end only
- `Composer.tsx:317`: `value.slice(0, -1)` — backspace from end only
- No `cursor` state variable exists in the component
- No left/right arrow handling for cursor movement
- No Ctrl+A/E, Ctrl+W, Alt+Enter
- 443 lines mixing text editing, menu state, animation timers, server-append, file attachments

**Fix:**
- Add `cursor` state tracking position within `value`
- Left/right arrows move cursor; Ctrl+A (home), Ctrl+E (end), Ctrl+W (delete word back)
- Backspace/Delete at cursor position
- Alt+Enter or Ctrl+J for newline (multi-line)
- Extract into `useTextInput({ initialValue, onSubmit })` hook returning `{ value, cursor, insert, delete, home, end, clear, handlers }`
- Extract `useMentions(client)` and `useSlashCommands(commands)` hooks

**Files:** `Composer.tsx` (major refactor), `BottomDock.tsx`

## 4.2 Rendering Performance (Severity: Critical)

**Problem:** Performance degrades linearly with conversation length.

**Code evidence:**
- `MessageList.tsx:144-147`: `totalHeight` useMemo depends on `[messages, parts, width]`. Runs `marked.lexer` via `lex()` on every text part of every message per delta flush. For 30 messages: ~30 lex operations every 50ms.
- `MessageList.tsx:248-263`: `.map()` iterates all messages unconditionally — no virtualization
- `MessageList.tsx:103-111`: `useSessionParts()` creates new `out` object reference on every delta flush, defeating memo
- `UserMessage`, `AssistantMessage`, `ToolPart` — none wrapped in `React.memo`
- No height cache for completed messages

**Fix:**
1. **Height cache:** `Map<messageID, { height: number, partsVersion: number }>`. Only recompute for the message currently receiving deltas (check `msg.time?.completed`). All completed messages have stable heights.
2. **React.memo:** Wrap UserMessage, AssistantMessage, ToolPart. Verify no inline object creation in MessageList's `.map()`.
3. **Stabilize `useSessionParts`:** Return store references directly, avoid creating new objects in selectors.
4. **Windowed rendering:** Only render viewport + 2-message buffer. Use spacer `<Box height={N}>` for scroll math.
5. **Debounced markdown lexing:** During streaming, show raw text; lex on 200ms quiet period or message completion.

**Files:** `MessageList.tsx`, `UserMessage.tsx`, `AssistantMessage.tsx`, `parts/ToolPart.tsx`, `store.ts`

## 4.3 Visual Hierarchy (Severity: High)

**Problem:** Everything is approximately the same visual weight. No scanability.

**Code evidence:**
- `UserMessage.tsx:29`: `borderColor={theme.cyan}` — user messages
- `AssistantMessage.tsx:55`: `borderColor={theme.surface2}` — assistant messages
- Both use `borderLeft={true}` — structural difference too subtle
- No systematic use of dim/normal/bold across the component tree
- Each component uses `color={theme.text}` or `color={theme.subtext}` inconsistently

**Fix:** Implement 3-weight system consistently:
- User input: `color={theme.text}` + bold + cyan left border
- Assistant text: `color={theme.text}` normal weight
- Tool calls: `color={theme.subtext}` or `dimColor` for entire ToolPart
- Metadata (footer, timestamps, tokens): `color={theme.overlay}`

**Files:** `UserMessage.tsx`, `AssistantMessage.tsx`, `parts/ToolPart.tsx`

## 4.4 Tool Call Presentation (Severity: High)

**Problem:** Tool calls use 10 distinct glyphs (6 kind + 4 status). Running tools show raw JSON. Collapse logic is inverted.

**Code evidence:**
- `ToolPart.tsx:57-65`: `kind()` maps to 6 icons (`◇`, `✎`, `$`, `⊕`, `⬡`, `◎`)
- `ToolPart.tsx:12-17`: `STAT` has 4 status icons (`◌`, `◎`, `✓`, `✗`)
- `ToolPart.tsx:73`: `const open = state.status !== "completed" || collapsed === false` — open during running, collapsed after completion
- `ToolPart.tsx:29-44`: `span()` produces noisy summaries like `"file_read src/store.ts"`
- `ToolPart.tsx:85,91`: `borderStyle="round"` doesn't match any other visual pattern

**Fix:**
- Reduce to 4 kind icons: `◇` (read), `✎` (write/edit), `$` (execute), `⬡` (mcp)
- Change line 73 to: `collapsed === false` — all tools start collapsed
- Use `state.title` (line 75, already available) as primary display
- Running: one-line animated "reading src/store.ts..." — no JSON body
- Completed: collapsed summary "Read src/store.ts (142 lines) · 0.3s"
- Errors: always expanded, red border
- Replace `borderStyle="round"` with `borderLeft={true} borderColor={theme.surface0}`

**Key insight:** Running and completed-collapsed are both single-line, so the transition causes zero layout shift.

**Files:** `parts/ToolPart.tsx`

## 4.5 Layout & Shell (Severity: High)

**Problem:** Header and StatusBar lack visual anchoring — blend into content.

**Code evidence:**
- `Header.tsx:19`: plain `<Box height={1}>` with text — no background
- `StatusBar.tsx:20`: same pattern — no background
- No "window frame" effect

**Fix:** Add `backgroundColor={theme.mantle}` to Header and StatusBar `<Box>` elements. ~15 minutes. Immediately makes the UI feel framed.

**Files:** `Header.tsx`, `StatusBar.tsx`

## 4.6 Duplicate Status Indicators (Severity: Medium)

**Problem:** Generation state shown in header spinner, composer spinner, and status bar simultaneously.

**Code evidence:**
- `Header.tsx:27`: spinner during generation
- `Composer.tsx:374`: spinner-like cue during generation

**Fix:** Pick one primary generation indicator. The composer should show a dim "Generating..." state. The header should show session status (ready/generating/error). Remove redundancy.

**Files:** `Header.tsx`, `StatusBar.tsx`, `Composer.tsx`

## 4.7 State Management (Severity: High)

**Problem:** Single store mixes hot streaming data with cold UI config.

**Code evidence:**
- `store.ts`: 49 fields, 42 actions in one store
- `SessionScreen.tsx`: 14 `useAppStore()` calls — all evaluate on every `set()`
- `appendPartDelta` calls `set()` at 20Hz, triggering all 14 selectors
- Network-calling actions (`sendPrompt`, `createSession`, `setProviderApiKey`, `oauthAuthorize`) mixed with pure state transitions

**Fix (phased):**
1. **Phase 1:** Narrow selectors. Replace `useAppStore(s => s.field)` with session-scoped derived selectors. Stop creating new objects/arrays inside selectors.
2. **Phase 2 (if measurement warrants):** Split into 3 stores:
   - `useStreamStore`: messages, parts, composerStatus, sessionStatus, permissions, questions, collapsedTools, scrollPos — the 20Hz hot path
   - `useAppStore`: client, sessions, providers, agents, commands, config — bootstrap data
   - `useUIStore`: route, dialogs, toasts, theme, model, mode, promptHistory, frecency — UI state
3. Move network actions to a service layer: `sessionService.ts`, `providerService.ts`, `mcpService.ts`.

**Files:** `store.ts` (potentially split into 3 files)

## 4.8 Streaming Behavior (Severity: High)

**Problem:** Height estimation is O(n × text_length) per frame during streaming.

**Code evidence:**
- `MessageList.tsx:144-147`: `totalHeight` useMemo depends on `parts` — new reference every flush
- The `parts` value from `useSessionParts()` is a new object on every delta (lines 103-111 create new `out` record)
- All completed messages' heights are needlessly recomputed

**Fix:** Cache height per message ID. Only recompute for the in-progress message. Version key: `parts.length + last text part length`. All completed messages have immutable heights.

**Files:** `MessageList.tsx`

## 4.9 Code Organization (Severity: Medium)

**Problem:** Large files, dead code, type casts.

**Code evidence:**
- `Composer.tsx`: 443 lines, mixes 5+ concerns
- `store.ts`: 631 lines, mixes state with API orchestration
- `(sess as any).parentID` at SessionScreen:46
- `(p as any).synthetic` at UserMessage:15
- `(msg as Message & {...})` at AssistantMessage:34-41
- `InputBar.tsx`, `ChatPane.tsx`, `ContextPane.tsx` — dead code
- `Sidebar.tsx` — `active={false}` hardcoded

**Fix:**
- Create extended types: `type SessionExt = Session & { parentID?: string }`, `type MessageExt = Message & { modelID?: string; finish?: string; error?: {...}; mode?: string }`
- Remove or archive dead code
- Either activate sidebar with proper focus management or remove it
- Add React error boundaries around MessageList and BottomDock

**Files:** New `types.ts`, `SessionScreen.tsx`, `UserMessage.tsx`, `AssistantMessage.tsx`, `Sidebar.tsx`

## 4.10 Responsiveness (Severity: Medium)

**Problem:** Fixed sidebar width (32 cols at `SessionScreen.tsx:69`) steals 32-40% of an 80-col terminal.

**Fix:** Auto-hide sidebar below 120 columns. Or redesign as an overlay. Define width-band breakpoints and test under tmux, SSH, and 80×24.

**Files:** `SessionScreen.tsx`, `Sidebar.tsx`

## 4.11 HomeScreen (Severity: Low-Medium)

**Problem:** Large centered ASCII logo wastes vertical space on short terminals.

**Fix:** Compress to a compact, action-first landing: recent sessions, model/status, and next actions. Show logo only on wide terminals (>120 cols).

**Files:** `HomeScreen.tsx`

## 4.12 ThemePickerDialog Performance (Severity: Medium)

**Problem:** Live-previewing themes on every navigation tick triggers global rerenders via theme context.

**Code evidence:** `ThemePickerDialog.tsx:32` — theme preview on navigate

**Fix:** Keep preview local until confirmation. Only commit theme to context on selection.

**Files:** `ThemePickerDialog.tsx`

---

# 5. Target UX

## Visual Mockups

### Message/Tool Area
```
┌─ bettercode ── main ── 3 sessions ──────────── ● ready ─┐  ← mantle bg
│                                                           │
│ • fix the login bug in auth.ts                            │  ← cyan border, bold
│                                                           │
│ ◆ I'll look at the auth module and fix the login bug.     │  ← surface2 border
│                                                           │
│   ✓ Read auth.ts (89 lines)                        0.2s  │  ← subtext, dim
│   ✓ Read auth.test.ts (145 lines)                  0.3s  │  ← subtext, dim
│   ✎ Write auth.ts                                  0.1s  │  ← subtext, dim
│                                                           │
│   I've fixed the issue. The problem was a missing null    │  ← text, normal
│   check on the user object at line 42.                    │
│                                                           │
│   build · claude-sonnet-4-20250514 · 3.2s · 1.2k tokens        │  ← overlay, dim
│                                                           │
├───────────────────────────────────────────────────────────┤
│ › _                                                       │
├─ plan │ claude-sonnet-4-20250514 │ ctrl+k: cmds  shift+tab: agent ─┤  ← mantle bg
└───────────────────────────────────────────────────────────┘
```

### Tool Call States

**Running (single line, animated):**
```
  ◎ reading src/store.ts...                              1.2s
```

**Completed (collapsed, default):**
```
  ✓ Read src/store.ts (142 lines)                        0.3s
```

**Completed (expanded on user request):**
```
  ✓ Read src/store.ts (142 lines)                        0.3s
  │ import React from "react"
  │ import { Box, Text } from "ink"
  │ ...
  │ ... 112 more lines
```

**Error (always expanded):**
```
  ✗ Write /etc/hosts                                     0.1s
  │ EACCES: permission denied
```

**5+ consecutive tools (groupable):**
```
  5 tools executed: 3 reads, 1 write, 1 exec · 2.1s     [expand]
```

### Composer States

**Idle:**
```
─────────────────────────────────────────────────────
› Type a message... (/ commands, @ files)█
```

**Generating:**
```
─────────────────────────────────────────────────────
⠹ Generating... (↑↓ scroll · ctrl+c abort)
```

**Multi-line (future):**
```
─────────────────────────────────────────────────────
│ here's the error I'm seeing:
│ TypeError: Cannot read property 'user'
│ of undefined at line 42█
```

**With stash:**
```
stash: fix the login bug i... (ctrl+y to restore)
─────────────────────────────────────────────────────
› █
```

## Target Experience Summary

- **Starting:** Calm shell, focused composer, quiet status. No splash screen. Bootstrap "Connecting..." is a slim header indicator, not a centered overlay.
- **Reading responses:** Assistant text is primary. Tool calls are dim single-line summaries. Footer (model/tokens/duration) appears on completed messages in `color={theme.overlay}`.
- **During streaming:** Input shows dim "Generating..." with spinner. Message area pins to bottom. Tool calls are animated one-liners ("◎ reading..."). Transition to completed state: zero layout shift.
- **Entering prompts:** Cursor-aware, multi-line, readline keybindings. @mentions with fuzzy match. /commands with prefix filter. Caret blinks at 530ms.
- **Long sessions:** Responsive because completed messages are height-cached, memoized, and virtualized. Token counter in StatusBar transitions green→yellow→red near context limits.

---

# 6. Architecture Specification

## Component Tree

```
App
├── ThemeProvider
│   └── ScreenRouter
│       ├── HomeScreen
│       └── SessionScreen
│           ├── HeaderBar            # Fixed 1 row, backgroundColor={mantle}
│           ├── MessageViewport      # Fills remaining space
│           │   ├── ScrollIndicator  # Absolute top-right when scrolled
│           │   └── VirtualWindow    # Only renders visible messages
│           │       ├── UserMessage (React.memo)
│           │       └── AssistantMessage (React.memo)
│           │           ├── TextPart
│           │           ├── ToolCallLine (collapsed, React.memo)
│           │           ├── ToolCallDetail (expanded)
│           │           ├── ReasoningPart
│           │           └── MessageFooter
│           ├── ToastLayer           # Absolute overlay
│           ├── PermissionBar        # Conditional, above composer
│           ├── ComposerBar          # Fixed height
│           │   ├── MentionOverlay   # Absolute above input
│           │   ├── SlashOverlay     # Absolute above input
│           │   ├── Separator        # ─── line
│           │   └── InputLine        # Uses useTextInput hook
│           └── StatusBar            # Fixed 1 row, backgroundColor={mantle}
└── DialogOverlay                    # Absolute full-screen when active
```

## Key Abstractions

**`useTextInput({ initialValue, onSubmit })`** — extracted from Composer:
```typescript
interface TextInputState {
  value: string
  cursor: number
  insert(char: string): void
  deleteBack(): void       // at cursor
  deleteForward(): void    // at cursor
  deleteWord(): void       // Ctrl+W
  home(): void             // Ctrl+A
  end(): void              // Ctrl+E
  left(): void
  right(): void
  clear(): void
  newline(): void          // Alt+Enter
  handlers: InkInputHandler
}
```

**`useListNavigation(items, options)`** — reused across CommandPalette, SessionList, ModelPicker, AgentPicker, McpDialog, ThemePickerDialog, SlashMenu, MentionMenu:
```typescript
interface ListNavState<T> {
  selectedIndex: number
  selectedItem: T | null
  handlers: InkInputHandler
}
```

**`HeightCache`** — module-scoped, keyed by messageID:
```typescript
// Map<messageID, { height: number, version: number }>
// version = parts.length + last text part length
// Only recompute when version changes (i.e., message still streaming)
```

## Message Rendering Pipeline

1. Store delivers `messages[]` and `parts{}` for current session via session-scoped selectors
2. MessageViewport computes visible range using cached heights + scroll offset
3. VirtualWindow renders only `[visible_start - 2, visible_end + 2]`
4. Each message component receives `message` + `parts[]`, is `React.memo`'d
5. Parts rendered by type dispatch inside each message
6. ToolCallLine (collapsed) is default; ToolCallDetail renders on expand
7. MarkdownRenderer results memoized by `useMemo([text])`

## Styling Strategy

Keep current theme system (well-designed). Additions:
- Semantic weight map: `const WEIGHT = { primary: 'text', secondary: 'subtext', tertiary: 'overlay' } as const`
- Frame background: `theme.mantle` for Header/StatusBar
- Standardize on `borderLeft` only for hierarchy. No `borderStyle="round"`. Full borders only for code blocks.
- Color semantics: green=success, red=error, yellow=warning/in-progress, cyan=user/interactive

## Performance Strategy

1. **Delta batching** (50ms) — keep as-is
2. **Height cache** — `Map<messageID, { height, version }>`, invalidate only for in-progress message
3. **Virtual window** — render viewport + 2-message buffer, spacer `<Box height={N}>` elements
4. **React.memo** on UserMessage, AssistantMessage, ToolPart, TextPart
5. **Stable selectors** — return store references directly, never create new objects
6. **Debounced markdown lexing** — during streaming, show raw text; lex on 200ms quiet or completion
7. **Store splitting** (Phase 2) — 3 stores isolating update frequencies

---

# 7. Implementation Roadmap

## Phase 1: Highest Leverage (weeks 1-2)

### 1.1 Header/StatusBar Background
- **Impact:** High — immediate professional framing
- **Effort:** 15 minutes
- **What:** Add `backgroundColor={theme.mantle}` to `Header.tsx:19` and `StatusBar.tsx:20`
- **Acceptance:** Header and StatusBar visually frame the content area

### 1.2 Three-Weight Visual Hierarchy
- **Impact:** High — transforms scanability
- **Effort:** 2-3 hours
- **What:** Apply dim treatment to ToolPart, bold to UserMessage, normal to AssistantMessage. Use `color={theme.subtext}` for tool rows, `color={theme.overlay}` for metadata.
- **Files:** `UserMessage.tsx`, `AssistantMessage.tsx`, `parts/ToolPart.tsx`
- **Acceptance:** Conversation has clear visual rhythm; user messages are instantly findable by scanning

### 1.3 Tool Call Collapse Inversion
- **Impact:** High — reduces noise during generation
- **Effort:** 2 hours
- **What:** Change `ToolPart.tsx:73` to `collapsed === false`. Prefer `state.title` (line 75) over `span()`. Reduce kind icons from 6 to 4. Replace `borderStyle="round"` with `borderLeft`.
- **Files:** `parts/ToolPart.tsx`
- **Acceptance:** Running tools show one-line status. Completed tools are collapsed. Errors are expanded. No JSON input shown by default.

### 1.4 Composer Cursor Support
- **Impact:** Critical — table-stakes for production
- **Effort:** 4-6 hours
- **Risk:** Medium — input handling is delicate
- **What:** Add `cursor` state. Implement left/right, Ctrl+A/E, Ctrl+W, backspace/delete at cursor, Alt+Enter for newline.
- **Files:** `Composer.tsx`
- **Acceptance:** User can position cursor anywhere, edit in middle, use readline keybindings

### 1.5 Context-Sensitive StatusBar
- **Impact:** Medium — improves discoverability
- **Effort:** 45 minutes
- **What:** Extend `StatusBar.tsx:16` hint logic for: dialog open, permission pending, scrolled up, generating.
- **Files:** `StatusBar.tsx`
- **Acceptance:** Hints change based on current UI state

### 1.6 Deduplicate Generation Indicators
- **Impact:** Medium — reduces visual noise
- **Effort:** 1 hour
- **What:** Remove composer spinner during generation; keep header status indicator. Composer shows dim text "Generating..." only.
- **Files:** `Header.tsx`, `Composer.tsx`
- **Acceptance:** One primary generation indicator, no competing spinners

## Phase 2: Structural Improvements (weeks 3-5)

### 2.1 Height Cache for Completed Messages
- **Impact:** High — eliminates O(n) markdown lex per frame
- **Effort:** 3-4 hours
- **What:** `Map<messageID, { height, version }>`. Only recompute for in-progress message.
- **Depends on:** Nothing
- **Files:** `MessageList.tsx`
- **Acceptance:** `marked.lexer` runs only for the active streaming message, not all messages

### 2.2 React.memo on Message Components
- **Impact:** Medium-High — prevents re-rendering completed messages
- **Effort:** 2 hours
- **What:** Wrap UserMessage, AssistantMessage, ToolPart. Fix any inline object creation in MessageList `.map()`.
- **Files:** `UserMessage.tsx`, `AssistantMessage.tsx`, `parts/ToolPart.tsx`, `MessageList.tsx`
- **Acceptance:** Completed messages do not re-render during streaming

### 2.3 Stabilize useSessionParts
- **Impact:** Medium — prerequisite for effective memo
- **Effort:** 2 hours
- **What:** Fix `MessageList.tsx:103-111` to return stable references for unchanged messages.
- **Files:** `MessageList.tsx`
- **Acceptance:** `useSessionParts` returns same object reference when underlying data hasn't changed

### 2.4 Composer Refactor: Extract Hooks
- **Impact:** Medium — enables multi-line, improves maintainability
- **Effort:** 6-8 hours
- **Depends on:** 1.4
- **What:** Extract `useTextInput`, `useMentions`, `useSlashCommands` hooks.
- **Files:** `Composer.tsx`, new hook files
- **Acceptance:** Composer.tsx under 200 lines. Each hook testable independently.

### 2.5 Fix Type Casts
- **Impact:** Medium — reduces maintenance hazard
- **Effort:** 3-4 hours
- **What:** Create `types.ts` with `SessionExt`, `MessageExt`. Replace all `as any` casts.
- **Files:** New `types.ts`, `SessionScreen.tsx`, `UserMessage.tsx`, `AssistantMessage.tsx`
- **Acceptance:** Zero `as any` in core TUI surfaces

### 2.6 Narrow Store Selectors
- **Impact:** High — reduces rerender scope
- **Effort:** 4-6 hours
- **What:** Replace broad `useAppStore(s => s.field)` patterns with session-scoped derived selectors. Stop creating new objects in selectors.
- **Files:** `store.ts`, `SessionScreen.tsx`, `MessageList.tsx`
- **Acceptance:** Streaming updates don't trigger selectors for unrelated UI chrome

### 2.7 Windowed Message Rendering
- **Impact:** High — O(1) rendering regardless of conversation length
- **Effort:** 8-12 hours
- **Depends on:** 2.1, 2.2
- **What:** Render only viewport + 2-message buffer. Spacer boxes for scroll math.
- **Files:** `MessageList.tsx`
- **Acceptance:** 500-message session renders as fast as 10-message session

### 2.8 Remove Dead Code
- **Impact:** Low-Medium — reduces confusion
- **Effort:** 30 minutes
- **What:** Delete `InputBar.tsx`, `ChatPane.tsx`, `ContextPane.tsx`. Either activate Sidebar or remove it.
- **Files:** Those files + `SessionScreen.tsx:137`
- **Acceptance:** Component tree contains only live code

## Phase 3: Polish & Advanced Features (weeks 6+)

### 3.1 Multi-Line Composer Input
- **Impact:** High for coding workflow
- **Effort:** 4-6 hours
- **Depends on:** 2.4
- **What:** Alt+Enter inserts newline. Render multi-line by splitting on `\n`. Up/Down navigates history only when cursor is at first/last line.
- **Acceptance:** Users can paste multi-line code/errors and edit them

### 3.2 Store Splitting (if measurement warrants)
- **Impact:** High — isolates streaming hot path
- **Effort:** 8-12 hours
- **Depends on:** 2.6 (measure after narrowing selectors)
- **What:** Split into `useStreamStore`, `useAppStore`, `useUIStore` per Section 4.7. Move network actions to service layer.
- **Acceptance:** Streaming updates don't trigger UI-state selectors

### 3.3 In-Session Search (Ctrl+F)
- **Impact:** Medium — power user feature
- **Effort:** 6-8 hours
- **What:** Search overlay, highlight matches, Enter/Shift+Enter to jump between.
- **Acceptance:** User can find specific text in conversation history

### 3.4 Transcript Landmarks & Jump Navigation
- **Impact:** Medium
- **Effort:** 4-6 hours
- **What:** Jump to latest, jump to errors, jump to pending confirmations. Breadcrumb when scrolled up: "Message 12/47 · 3 min ago".
- **Acceptance:** Users can navigate long sessions without manual scrolling

### 3.5 Responsive Sidebar & Narrow-Width Behavior
- **Impact:** Medium
- **Effort:** 4-6 hours
- **What:** Auto-hide sidebar below 120 cols. Test under tmux, SSH, 80×24.
- **Acceptance:** 80-column terminal is usable without sidebar eating space

### 3.6 Tool Summary Grouping
- **Impact:** Medium
- **Effort:** 4-6 hours
- **Depends on:** 1.3
- **What:** 5+ consecutive tool calls group into single summary line expandable to individual tools.
- **Acceptance:** Tool-heavy turns are scannable at a glance

### 3.7 Error Boundaries
- **Impact:** Medium (reliability)
- **Effort:** 2 hours
- **What:** React error boundaries around MessageList and BottomDock.
- **Acceptance:** A render error in one message doesn't crash the entire TUI

### 3.8 HomeScreen Compact Mode
- **Impact:** Low-Medium
- **Effort:** 2 hours
- **What:** Compress home to action-first launcher. Logo only on wide terminals.
- **Acceptance:** Short terminals show recent sessions and next actions, not branding

### 3.9 ThemePickerDialog Fix
- **Impact:** Low
- **Effort:** 1 hour
- **What:** Keep theme preview local until confirmation.
- **Acceptance:** Navigating theme options doesn't trigger global rerenders

### 3.10 Shared Dialog Primitives
- **Impact:** Medium (code quality)
- **Effort:** 6-8 hours
- **What:** Extract `useListNavigation`, shared dialog frame for CommandPalette, SessionList, ModelPicker, etc.
- **Acceptance:** New dialogs can reuse frame instead of reimplementing

### 3.11 Performance Instrumentation
- **Impact:** Medium (developer tooling)
- **Effort:** 4 hours
- **What:** `React.Profiler` around transcript/composer. Dev-mode render counters. Synthetic 500/1000-message benchmark. Track delta batch sizes in useSDK.
- **Acceptance:** Engineers can observe and measure rerender behavior

---

# 8. Quick Wins

Changes that noticeably improve the product and can each be done in under 2 hours. Good first PR candidates.

| # | Change | Effort | Files |
|---|--------|--------|-------|
| 1 | Add `backgroundColor={theme.mantle}` to Header and StatusBar | 15 min | `Header.tsx:19`, `StatusBar.tsx:20` |
| 2 | Change ToolPart title text to `color={theme.subtext}`, keep only status icon in status color | 30 min | `parts/ToolPart.tsx:105` |
| 3 | Reduce `kind()` from 6 to 4 icons: `◇` read, `✎` write, `$` exec, `⬡` mcp | 15 min | `parts/ToolPart.tsx:57-65` |
| 4 | Prefer `state.title` for tool summaries (line 75 already checks) | 15 min | `parts/ToolPart.tsx:75` |
| 5 | Invert tool collapse: change line 73 to `collapsed === false` | 15 min | `parts/ToolPart.tsx:73` |
| 6 | Context-sensitive StatusBar hints (dialog open, permission, scrolled up) | 45 min | `StatusBar.tsx:16` |
| 7 | Replace `borderStyle="round"` with `borderLeft borderColor={theme.surface0}` | 15 min | `parts/ToolPart.tsx:85,91` |
| 8 | Wrap UserMessage and AssistantMessage in `React.memo` | 30 min | `UserMessage.tsx`, `AssistantMessage.tsx` |
| 9 | Fix `(sess as any).parentID` — create `type SessionExt` | 30 min | New type def, `SessionScreen.tsx:46` |
| 10 | Remove or activate sidebar (remove `active={false}` or delete) | 30 min | `SessionScreen.tsx:137`, `Sidebar.tsx` |

---

# 9. Production Readiness Checklist

- **Usability:** One way to get help. One way to switch sessions. One way to inspect tools. One way to abort. Composer stays readable for hours.
- **Consistency:** One status vocabulary. One hint style. One border grammar. One keyboard story across all dialogs.
- **Reliability:** Reconnect keeps app alive. Permission/question prompts always resolve. Abort never strands composer. Error boundaries catch render crashes.
- **Performance:** 500+ message sessions remain usable. Delta streaming stays batched. Render cost proportional to visible content. No flicker on modal transitions.
- **Accessibility:** Color never the only state signal. Every action has a text label. Focus and selection obvious without hue. Keyboard flows work without mouse.
- **Maintainability:** Dead code removed. Selectors narrow. No `as any` in core surfaces. Transcript pipeline testable in isolation.

---

# 10. Contributor Rules

1. Do not add new transcript-wide selectors in render paths
2. Do not default-expand large payloads in tool rows
3. Do not use color as the only state signal
4. Do not add new shell chrome without clear hierarchy value
5. Do not add hot-path abstractions without measured benefit
6. Do not leave `JSON.stringify` or unbounded markdown parsing on the hot render path
7. Do not introduce `as any` casts — extend types properly
8. Test every UI change at 80×24 terminal width and with 100+ message sessions
