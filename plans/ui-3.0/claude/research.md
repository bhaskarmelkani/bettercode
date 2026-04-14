# BetterCode TUI: Comprehensive Audit & Redesign Strategy

**Date:** 2026-04-14
**Scope:** Full UX audit, architecture review, performance analysis, and implementation roadmap
**Repo:** bettercode (fork of OpenCode with Ink-based TUI)

---

## 1. Executive Summary

### Current Overall Quality

BetterCode's TUI is a **functional prototype with strong architectural bones**. The delta batching, binary-search sorted arrays, session-scoped selectors, and useShallow guards demonstrate genuine performance awareness. The component hierarchy is logical. The theme system is well-structured with 7 production-quality palettes.

However, the UI currently feels like an **engineer's first pass** rather than a polished product. It is usable but not beautiful, functional but not calm, and capable but not fast-feeling.

### Biggest Strengths

1. **Delta batching** (50ms flush in `hooks/useSDK.ts`) -- correctly solves the streaming repaint problem. Text deltas are buffered and flushed in batch, capping repaints at ~20/sec instead of ~100/sec.
2. **Binary-search state management** (`bsearch()` in `store.ts`) -- O(log n) sorted insertions for sessions, messages, parts, permissions, questions.
3. **Session-scoped selectors** (`useSessionParts()` in `MessageList.tsx`) -- prevents cross-session rerender noise by watching only the current session's message parts.
4. **Theme system** (`theme.ts`) -- 17 semantic color slots across 7 palettes (Catppuccin Mocha/Latte/Macchiato/Frappe, Gruvbox, Nord, Dracula). Clean abstraction via React context.
5. **Sticky scroll** with per-session persistence -- correct UX instinct. Scroll position is stored in `scrollPos[sessionID]` and restored on session switch.
6. **Frecency sorting** for commands, models, sessions -- rewards repeated workflows, surfaces the most relevant items first.

### Biggest UX Problems

1. **Flat information hierarchy** -- tool calls, text, metadata all share the same visual weight. No 3-level weight system.
2. **No cursor movement in Composer** -- cannot edit middle of input; append-only. `Composer.tsx:338-339` just concatenates: `value + input`.
3. **No multi-line input** -- critical for a coding agent where users paste code/errors/specifications.
4. **Tool calls are too noisy during execution, too hidden after completion** -- the collapse logic at `ToolPart.tsx:73` is inverted: shows tools while running (with JSON input), collapses after completion.
5. **Header and StatusBar lack visual anchoring** -- blend into content with no background treatment; just `<Box height={1}>` with inline text.
6. **Sidebar is dead code** -- `active={false}` hardcoded at `SessionScreen.tsx:137`, keyboard input never reaches it.

### Biggest Architecture/Code Quality Problems

1. **Monolithic Zustand store** (631 lines, 49 state fields, 42 actions) -- every `set()` notifies all subscribers. 14 `useAppStore()` calls in SessionScreen alone.
2. **Type casts everywhere** -- `(sess as any).parentID` in SessionScreen:46, `(p as any).synthetic` in UserMessage:15, `(msg as Message & {...})` in AssistantMessage:34-41. SDK types don't match runtime data.
3. **No message virtualization** -- all messages rendered in React tree regardless of viewport. The `.map()` at MessageList:248-263 iterates all messages unconditionally.
4. **Height estimation recomputes for ALL messages on every delta** -- `totalHeight` useMemo at MessageList:144-147 depends on `parts`, which is a new object reference every flush.
5. **Composer.tsx at 443 lines** mixes text editing, menu state, animation timers, and rendering in one component.

### Top Opportunities

1. **Visual hierarchy through 3-weight system** (bold/normal/dim) -- highest leverage visual improvement, zero architecture cost.
2. **Windowed message rendering** -- biggest performance improvement for long sessions.
3. **Height caching for completed messages** -- eliminates O(n) markdown lexing per frame.
4. **Cursor-aware input with multi-line** -- table-stakes for coding tool UX.
5. **Store splitting** -- isolate streaming hot path from UI state notifications.

---

## 2. Repo Structure Summary

### Entry & Bootstrap

| File | Role |
|------|------|
| `packages/opencode/bin/bettercode` | Shell shim: detects dev vs prod, spawns `bun run src/index.ts bettercode` or compiled binary |
| `packages/opencode/src/cli/cmd/bettercode.ts` | Yargs command: calls `bootstrap()`, starts `Server`, spawns TUI as child process with env vars (`BETTERCODE_URL`, `BETTERCODE_DIR`, `BETTERCODE_SESSION`, `BETTERCODE_PASSWORD`) |
| `packages/tui-ink/src/index.tsx` | TUI entry: loads prefs from `~/.config/bettercode/prefs.json`, inits Zustand store, renders `<App />`, sets up store subscription for persistence, handles SIGINT |

### Core Architecture

| File | Lines | Role |
|------|-------|------|
| `packages/tui-ink/src/app.tsx` | 112 | Root: screen routing (home/session/plugin), global keys (Ctrl+C/K/N/S, Esc), dialog classification (dock vs overlay), responsive layout via stdout resize |
| `packages/tui-ink/src/store.ts` | 631 | Zustand store: 49 state fields + 42 actions + bsearch helper. Covers SDK client, bootstrap data, sessions, messages/parts, permissions/questions, UI state, navigation, persistence |
| `packages/tui-ink/src/hooks/useSDK.ts` | 281 | Bootstrap (parallel fetch of 9 datasets) + SSE event streaming with exponential backoff (1s->30s) + delta batching (50ms window) |
| `packages/tui-ink/src/theme.ts` | 165 | 7 themes with 17 semantic color slots per theme. Type: `Theme = { base, mantle, crust, text, subtext, overlay, blue, cyan, green, yellow, red, pink, lavender, mauve, surface0, surface1, surface2 }` |
| `packages/tui-ink/src/theme-context.tsx` | ~20 | React context provider for theme; `useTheme()` hook |

### Screens

| File | Lines | Role |
|------|-------|------|
| `src/screens/SessionScreen.tsx` | 143 | Main layout: Header + MessageList + ToastOverlay + BottomDock + Sidebar + StatusBar. Lazy-loads messages per session. Derives `generating` from session status + composerStatus. Calculates dynamic dock/list heights. |
| `src/screens/HomeScreen.tsx` | ~80 | Session creation / landing |
| `src/screens/PluginScreen.tsx` | ~50 | Plugin management |

### Message Rendering Pipeline

| File | Lines | Role |
|------|-------|------|
| `components/MessageList.tsx` | 268 | Scrollable list with: height estimation via markdown token measurement, sticky scroll with per-session persistence, mouse wheel (SGR), keyboard scroll (PageUp/Down/Shift+arrows/Ctrl+arrows), tool expand/collapse toggle ("e" key), React.memo wrapper |
| `components/UserMessage.tsx` | 47 | Cyan left border + bullet + markdown text + file badges + QUEUED indicator. NOT memoized. |
| `components/AssistantMessage.tsx` | 104 | Part dispatcher: TextPart, ReasoningPart, ToolPart, CompactionPart. Footer with mode/model/duration/tokens. Error display. NOT memoized. |
| `components/parts/TextPart.tsx` | 24 | Markdown text with optional lead diamond (◆) |
| `components/parts/ToolPart.tsx` | 115 | 4 status states (pending/running/completed/error) x 6 kind icons. Collapsible body. `span()` for input summary, `json()` for pending input, `line(cut())` for output/error truncation (2000 chars, 30 lines) |
| `components/parts/ReasoningPart.tsx` | 33 | Togglable thinking display, strips `[REDACTED]` |
| `components/parts/CompactionPart.tsx` | 12 | Single-line "context compacted" marker |
| `components/parts/FilePart.tsx` | 43 | MIME-colored file badges |
| `components/markdown/MarkdownRenderer.tsx` | 143 | GFM parser using `marked` lexer. Supports: headings, paragraphs, code blocks (bordered), lists, blockquotes, hr, inline formatting. `useMemo` on tokens. |
| `components/markdown/CodeBlock.tsx` | 32 | Bordered box with language label |
| `components/markdown/InlineText.tsx` | 70 | Recursive inline token walker: bold, italic, strikethrough, codespan (with bg), links, line breaks |

### Input & Composer

| File | Lines | Role |
|------|-------|------|
| `components/Composer.tsx` | 443 | Main input: 11 useState hooks, text editing (append-only, no cursor), history (up/down, deduped, max 200), stash (Ctrl+X/Y), @mentions (file search via SDK), /slash commands (built-in + registry + server), spinner (10-frame braille at 100ms), caret blink (530ms), server-append handling, file attachments |
| `components/SlashMenu.tsx` | 50 | Absolute-positioned menu above input, max 6 items, highlight selection |
| `components/InputBar.tsx` | 135 | Simpler input variant for other contexts (slash but no @mentions) |

### Dialogs & Panels

| File | Lines | Role |
|------|-------|------|
| `components/BottomDock.tsx` | 101 | Routes between: panel dialogs (command-palette, session-list, provider, model-picker, agent-picker, mcp, theme) OR permissions/questions + Composer. `dockHeight()` calculates dynamic height: base 4 + perm 5 + quest 7, panels cap at 15 |
| `components/CommandPalette.tsx` | 197 | Frecency-sorted commands, shows category/description/keybind |
| `components/SessionListDialog.tsx` | ~300+ | Hierarchical sessions (root + expandable children), frecency sorting, actions: create/rename/delete/fork/share/summarize/revert/abort |
| `components/ProviderDialog.tsx` | 547 | Multi-step auth state machine: list -> method-select -> prompts -> api-key or oauth-auto/oauth-code. Masked API key input. OAuth polling. |
| `components/ModelPickerDialog.tsx` | 182 | Current model highlighted, recents marked with star, frecency sorting |
| `components/AgentPickerDialog.tsx` | 122 | Current agent marked, X to clear |
| `components/McpDialog.tsx` | ~100 | MCP server status with color coding (green/gray/red/yellow) |
| `components/ThemePickerDialog.tsx` | 116 | Live preview on navigate, revert on escape |
| `components/DialogOverlay.tsx` | 140 | Overlay dispatcher: Confirm, Help, Alert dialogs |
| `components/PermissionPrompt.tsx` | 59 | y/a/n quick keys for permission approval |
| `components/QuestionPrompt.tsx` | 199 | Multi-question with option navigation, custom text input |

### Chrome & Status

| File | Lines | Role |
|------|-------|------|
| `components/Header.tsx` | 36 | Project name (cyan bold), git branch, session count, status indicator (● green/yellow/red), spinner during generation. No background color. |
| `components/StatusBar.tsx` | 32 | Agent mode pill (yellow=plan, blue=build), model name (cyan), keyboard hints (static: generating vs idle). No background color. |
| `components/Sidebar.tsx` | 179 | Tabbed pane: diff/todos/lsp/mcp/workspace. Tab/arrow switching. Lazy-loads todos. **Hardcoded `active={false}` in SessionScreen.** |
| `components/ToastOverlay.tsx` | 51 | Stacked vertically at top of MessageList. Icons: info/success/warning/error. Auto-dismiss. |
| `components/Spinner.tsx` | 28 | 10-frame braille at 120ms with optional label |

### Hooks & Utils

| File | Lines | Role |
|------|-------|------|
| `hooks/useMouse.ts` | 35 | Enables SGR extended mouse reporting, decodes scroll (Pb=64 up, Pb=65 down), emits to mouseScrollEvents |
| `mouseScrollEvents.ts` | ~15 | Simple EventEmitter pub/sub for scroll events |
| `frecency.ts` | ~40 | Access frequency scoring with time decay |
| `commands/registry.ts` | ~80 | Command registration with trigger/enable/disable |
| `commands/useCommands.ts` | ~30 | Returns filtered command list by enabled/category |

### Data Model (from SDK)

| File | Role |
|------|------|
| `packages/sdk/js/src/v2/gen/types.gen.ts` | Auto-generated types: Session, Message (UserMessage/AssistantMessage union), Part (Text/Reasoning/File/Tool/Subtask/Step/Snapshot/Patch/Agent/Retry/Compaction), Provider, Model, Agent, Config, PermissionRequest, QuestionRequest |
| `packages/sdk/js/src/v2/client.ts` | OpencodeClient factory for API consumption |

### Connection Architecture

```
bettercode CLI
  ↓ spawns server + TUI child process
  
OpenCode Server (Hono)
  ├── REST API (sessions, messages, providers, agents, config, etc.)
  └── SSE endpoint (/event) with 10s heartbeat
  
TUI (Ink + React + Zustand)
  ├── useSDK hook: bootstrap (9 parallel fetches) + SSE streaming
  ├── Delta batching: 50ms buffer → flush → store.appendPartDelta
  └── Store → React reconciliation → Ink terminal render
```

---

## 3. Research Findings

### 3.1 Hierarchy Over Decoration

**Principle:** In information-dense terminal UIs, visual hierarchy (weight, color, indentation) creates scanability. Decoration (borders, boxes, icons) adds noise without aiding comprehension.

**Why it matters for coding agents:** During a coding session, users alternate between reading agent output, scanning tool results, and composing prompts. They need to instantly distinguish "what the agent said" from "what tools did" from "what I asked." Flat hierarchy forces serial reading.

**Evidence:** Claude Code uses almost zero chrome -- no borders around messages, no boxes around tool calls. Just indentation, color weight, and whitespace. The result reads like a clean conversation. lazygit uses borders only to delineate panels (structural purpose), never for decoration. btop uses box-drawing characters, but each box is a distinct data domain (CPU, memory, network) -- the borders serve a structural function.

**Application to BetterCode:** Currently, UserMessage (`borderColor={theme.cyan}`) and AssistantMessage (`borderColor={theme.surface2}`) both use `borderLeft={true}` with slightly different colors. ToolPart adds `borderStyle="round"` for its body. The visual weight difference between user/assistant/tool is too subtle. A 3-weight system (bold user input, normal assistant text, dim tool calls) would create the hierarchy without adding any new borders or icons.

### 3.2 Stable Regions During Streaming

**Principle:** The viewport should have stable anchor points that don't move during streaming. The user's eyes need fixed reference points -- typically the header, footer, and input area.

**Why it matters:** When an LLM streams a response with interspersed tool calls, the content area changes rapidly. If the entire viewport shifts on every update, the user loses their reading position and the UI feels jittery.

**Evidence:** Claude Code keeps the input area pinned at the bottom. New content grows upward from above the input. The header never moves. Warp treats each prompt-response as a "block" with a fixed top edge that grows downward. Both maintain at least 2 stable reference points.

**Application to BetterCode:** The current `marginTop={absoluteTop}` approach in MessageList (line 247) shifts the entire content column on every scroll update. During streaming, height re-estimation causes `absoluteTop` to change on every 50ms delta flush, creating micro-jumps. The Header (1 row) and StatusBar (1 row) are stable anchors, but they're visually undifferentiated from content (no background color), reducing their anchoring effect.

### 3.3 Progressive Disclosure for Tool Output

**Principle:** Show the minimum information needed at each level. Let the user drill down on demand. Default to collapsed; expand on interaction.

**Why it matters:** A single agent turn can involve 5-20 tool calls. If each shows its full output, the conversation becomes unreadable. If all are collapsed, the user can't follow execution.

**Evidence:** Claude Code shows tool calls as single-line summaries by default ("Read file: src/store.ts"). Only when the user explicitly asks does it show the full output. Aider shows diffs inline but collapses file contents. lazygit shows a file list in one panel and the selected file's diff in another -- progressive disclosure via panel selection rather than inline expansion.

**Application to BetterCode:** The current `ToolPart.tsx` logic at line 73 (`const open = state.status !== "completed" || collapsed === false`) keeps tools OPEN while running/pending and collapses them after completion. This is backwards for readability: running tools show JSON input (noisy), completed tools hide their output (the useful part). The ideal: show a one-line status during execution ("reading src/store.ts..."), and keep completed tools collapsed with a semantic summary ("Read src/store.ts - 142 lines") that the user can expand.

### 3.4 Single Primary Focus

**Principle:** At any moment, the user should have exactly one primary interaction point. Secondary and tertiary information should be visually subordinate.

**Why it matters:** Terminal UIs lack the mouse-hover and floating-panel affordances of GUIs. The user's attention must be clearly directed. When everything demands equal attention, nothing gets attention.

**Evidence:** vim has exactly one active window/split at a time, with clear cursor placement. lazygit highlights the active panel's border in bold white and dims inactive panels to gray. Claude Code has exactly one focus: either you're reading output or you're typing input, with a clear visual boundary between them.

**Application to BetterCode:** Currently, the composer, message list, and status bar all have similar visual weight. When generating, the spinner in the composer and the streaming text in the message list compete for attention. The user's primary focus during generation should be the streaming output, with the composer receding to a minimal "generating..." indicator.

### 3.5 Keyboard-First Discoverability

**Principle:** Available actions should be visible in context without requiring memorization or a help screen. Shortcuts should be shown where they apply, not in a separate reference card.

**Why it matters:** Users of coding agents are keyboard-heavy. They expect shell-like fluency. But unlike shell commands, TUI shortcuts don't have tab-completion or man pages. If a shortcut isn't visible, it effectively doesn't exist for most users.

**Evidence:** lazygit shows context-sensitive shortcuts at the bottom of each panel. The shortcuts change when you switch panels. htop shows function key bindings in a persistent footer. Warp shows available completions inline as the user types.

**Application to BetterCode:** The StatusBar shows semi-static hints that change only between generating and idle states (`StatusBar.tsx:16`). The generating state shows different hints than idle, which is good, but there's no adaptation for when a dialog is open, when the sidebar is focused, when a permission prompt is active, or when the user is scrolled up in the message list.

### 3.6 Dense But Scannable Layouts

**Principle:** Every row should carry information. But information should be grouped with consistent visual patterns so the eye can skip to the relevant section without reading every line.

**Why it matters:** Terminal real estate is scarce -- typically 40-60 visible rows. A coding agent session might have dozens of messages. Wasted rows directly reduce how much context the user sees.

**Evidence:** btop packs CPU cores, memory bars, process lists, and network graphs into a single screen with no wasted space, yet remains readable through consistent pattern repetition (every process row looks the same). lazygit shows 4+ panels simultaneously. Both achieve density through consistent, repeated visual patterns.

**Application to BetterCode:** The current message rendering uses generous margins (`marginTop={1}` on every AssistantMessage) and deep nesting. A UserMessage has 4+ lines of overhead for a 1-line input: marginTop + border + paddingLeft=2 + nested Box with paddingLeft=1 + the actual text. The Box nesting in UserMessage (3 levels deep) is more complex than necessary.

### 3.7 Minimizing Visual Jitter

**Principle:** Layout dimensions should be predictable. Content area sizes should not change unless the user explicitly resizes or navigates. Surprise layout shifts destroy perceived quality.

**Why it matters:** Terminal rendering is not double-buffered the way GUI rendering is. When Ink re-renders, it rewrites terminal cells. If the layout shifts between frames, the user sees flicker.

**Evidence:** Ink's own documentation warns about `position="absolute"` and `marginTop` animations causing flicker. The recommended approach is fixed-size containers with `overflowY="hidden"` and content that flows within. Terminal apps like htop and btop use fixed panel sizes that only change on explicit terminal resize.

**Application to BetterCode:** The `dockHeight()` function in `BottomDock.tsx` returns different heights based on permissions/questions/dialogs. When a permission arrives mid-stream, the dock height jumps from 4 to 9 rows, shrinking the message list by 5 rows. This causes a jarring layout shift. The ToastOverlay and scroll indicator both use `position="absolute"` at the top of the viewport and can overlap.

### 3.8 Rendering Optimization in Ink

**Principle:** Ink re-renders the entire React tree on state changes. The optimization boundary is `React.memo` -- components that don't receive new props skip reconciliation. The biggest performance lever is reducing the number of `<Text>` and `<Box>` nodes. Each node requires ANSI escape sequence calculation.

**Why it matters:** With 50+ components in the tree and streaming updates at 20Hz, unnecessary reconciliation adds up. Each wasted reconciliation costs CPU time and potentially causes terminal flicker.

**Evidence:** Ink's maintainer (Vadim Demedes) has stated that the biggest performance bottleneck is the number of terminal nodes. React reconciliation is cheap compared to the ANSI rendering step. The second lever is `React.memo` with stable props to skip entire subtrees.

**Application to BetterCode:** `MessageList` is wrapped in `React.memo` (line 120), which is correct. But the components inside it (UserMessage, AssistantMessage, ToolPart) are NOT memoized. During streaming, when any part changes, the entire message list re-renders, including all completed messages and their tool parts. Each completed message's rendering is wasted work because its content is immutable.

### 3.9 Terminal Input Best Practices

**Principle:** Terminal text input should match the user's shell muscle memory. Ctrl+A/E, Ctrl+W, cursor movement, and history navigation are baseline expectations.

**Why it matters:** Coding agent users are power terminal users. An input that doesn't support basic readline-like keybindings feels broken, not simplified.

**Evidence:** Every serious terminal application (fish, zsh, fzf, lazygit's search) supports at minimum: cursor positioning with arrows, home/end with Ctrl+A/E, word deletion with Ctrl+W, and history navigation. Claude Code, Aider, and Codex CLI all support these.

**Application to BetterCode:** Composer.tsx has no cursor position state. Characters are appended to the end (`value + input` at line 339). Backspace removes from the end (`value.slice(0, -1)` at line 317). No left/right arrow handling for cursor movement. No Ctrl+A/E. No word-level operations. This is the single most impactful UX deficiency.

### 3.10 State Management for Complex TUIs

**Principle:** Split stores by update frequency. Hot-path state (streaming data, per-frame updates) should be isolated from cold-path state (UI preferences, bootstrap data) to minimize selector evaluation cost.

**Why it matters:** Zustand notifies all subscribers on every `set()` call. If streaming data and UI preferences share a store, every 50ms delta flush triggers evaluation of selectors that only care about theme or dialog state.

**Evidence:** The Zustand documentation recommends splitting stores "when different parts of your state are updated at different frequencies." The `subscribeWithSelector` middleware exists specifically for fine-grained subscriptions. Large React applications like Excalidraw split state into rendering state, UI state, and collaboration state.

**Application to BetterCode:** The single store has 49 fields and 42 actions. SessionScreen alone has 14 `useAppStore()` calls. During streaming, `appendPartDelta` calls `set()`, triggering evaluation of all 14 selectors. Most return stable references, but the evaluation cost at 20Hz is non-trivial.

---

## 4. Best-in-Class Design Principles for BetterCode

### Product Principles

1. **Conversation first.** The message thread is the primary artifact. Everything else -- tool calls, metadata, session info -- is subordinate context that supports the conversation.
2. **Flow over features.** Optimize for uninterrupted coding sessions, not feature checklists. Every UI element that interrupts flow must justify its existence.
3. **Trust the user.** Don't over-explain. Show terse, high-signal output. Let users drill down when they want detail. Assume competence.
4. **Calm confidence.** The UI should feel quiet and in control, even during complex multi-tool execution. No visual panic, no overwhelming status indicators.

### Visual Principles

5. **Three visual weights.** Bold/bright for user input and active prompt. Normal for assistant text. Dim for tool calls, metadata, timestamps, token counts. This single principle transforms scanability.
6. **Background-anchored chrome.** Header and StatusBar should use `backgroundColor` to visually frame the content area. This creates a "window" effect that anchors the eye without adding borders.
7. **Color for semantics, not decoration.** Green = success/addition. Red = error/deletion. Yellow = warning/in-progress. Cyan = user/interactive. Everything else is neutral. No color for color's sake.
8. **Whitespace as structure.** Use consistent spacing to create visual groups. No ornamental borders. One `marginTop={1}` between messages is enough.

### Interaction Principles

9. **Escape always goes back.** Close menu -> close dialog -> clear input -> deactivate, in that order. Universal, predictable.
10. **Context-sensitive hints.** The StatusBar always shows what you can do RIGHT NOW, not a static reference card.
11. **No mode confusion.** When generating vs idle changes key behavior (e.g., arrows = scroll vs history), the visual state must make the current mode unmistakable.
12. **Progressive disclosure by default.** Tool calls collapsed. Details on demand. Errors always visible. Reasoning hidden unless toggled.

### Information Architecture Rules

13. **One sentence per tool.** Completed tool calls should be expressible in one line: icon + semantic summary + duration.
14. **Footer for metadata.** Model, tokens, duration, mode -- all in a dim footer line after the assistant message, not inline with content.
15. **Breadcrumbs for position.** When scrolled away from bottom, show position context (message N/M, time offset).

### Performance Principles

16. **Budget: 20Hz.** Target 50ms per frame. Delta batching already achieves this for store updates. Component rendering must stay within budget.
17. **Cache completed work.** Height estimates, markdown tokens, and rendered output for completed messages should be cached and never recomputed.
18. **Virtualize the invisible.** Only render messages within the viewport + 2 message buffer above and below.
19. **Stable layouts.** Fixed dock height. Fixed header/status bar. Only the message area scrolls.

### Coding Principles for TUI Implementation

20. **Components under 200 lines.** Extract hooks for logic, keep components as thin renderers.
21. **No `as any` type casts.** Extend SDK types locally with proper typing if needed.
22. **Memoize at message boundaries.** Each UserMessage and AssistantMessage should be `React.memo` with stable props.
23. **Selectors over subscriptions.** Derive state in selectors, not in effects. Never create new objects/arrays inside selectors.

---

## 5. Audit of Current BetterCode UI

### 5.1 Layout & Information Architecture

**Severity: High**

**What:** Header, MessageList, BottomDock, StatusBar are stacked vertically with no visual differentiation between the frame (header/statusbar) and content (messages/input).

**Why it's a problem:** The eye has no anchor points. In a terminal full of text, the header text blends with message text. There's no "window frame" effect.

**Root cause:** `Header.tsx:19` and `StatusBar.tsx:20` render plain `<Box height={1}>` with text items -- no background color, no border treatment.

**Fix:** Add `backgroundColor={theme.mantle}` to Header and StatusBar Box elements. This creates a visual frame with zero layout cost.

**Files:** `components/Header.tsx`, `components/StatusBar.tsx`

### 5.2 Message Readability

**Severity: High**

**What:** User messages and assistant messages have near-identical visual weight. Both use `borderLeft={true}` with only a color difference (cyan vs surface2). Tool calls sit at the same visual weight as text.

**Why it's a problem:** In a long session, the user cannot quickly scan to find their own messages, which are the natural anchoring points of the conversation.

**Root cause:** `UserMessage.tsx:29` uses `borderColor={theme.cyan}`, `AssistantMessage.tsx:55` uses `borderColor={theme.surface2}`. The structural difference is too subtle to scan quickly.

**Fix:**
- Keep user messages with cyan border and bold treatment
- Make tool calls visually dimmer: use `color={theme.subtext}` + `dimColor` on non-essential elements
- Add `React.memo` to both UserMessage and AssistantMessage

**Files:** `components/UserMessage.tsx`, `components/AssistantMessage.tsx`, `components/parts/ToolPart.tsx`

### 5.3 Tool Call Presentation

**Severity: High**

**What:** Tool calls use 6 different kind icons (`◇`, `✎`, `$`, `⊕`, `⬡`, `◎` in `kind()` at lines 57-65) + 4 status icons (`◌`, `◎`, `✓`, `✗` in `STAT` at lines 12-17) = 10 distinct glyphs. Running tools show raw JSON input via `json(state.input)`. Completed tools auto-collapse but show the tool name + truncated `span()` summary.

**Why it's a problem:** The icon system has high cognitive load. The `span()` function (lines 29-44) produces noisy summaries like `"file_read src/store.ts"` when it should say `"Read store.ts"`. Running tools showing JSON input is visual noise during the most active phase of generation.

**Root cause:** `ToolPart.tsx` tries to be comprehensive with icons and summaries rather than semantic and minimal.

**Fix:**
- Reduce to 3-4 kind icons: read (`◇`), write (`✎`), execute (`$`), mcp (`⬡`)
- Show semantic summaries using `state.title` (already available at line 75) when provided by server
- During execution: one-line animated status only ("reading src/store.ts..."), no JSON body
- After completion: collapsed by default with summary; expand to see output
- Errors: always expanded

**Files:** `components/parts/ToolPart.tsx`

### 5.4 Streaming Behavior

**Severity: Medium**

**What:** Delta batching at 50ms works well. But `estimateHeight` in MessageList runs `marked.lexer` (via `lex()`) on every text part of every message on each delta flush, recomputing total height for the entire conversation.

**Why it's a problem:** For a 30-message session, that's ~30 markdown lex operations every 50ms. Each lex parses the full message text. This is O(n * text_length) per frame.

**Root cause:** `MessageList.tsx:144-147` -- `totalHeight` useMemo depends on `[messages, parts, width]`. The `parts` value returned by `useSessionParts()` is a new object reference on every delta flush (because it creates a new `out` record in the useMemo at lines 103-111).

**Fix:** Cache height per message ID. Only recompute height for the message currently receiving deltas (identified by the `pending` variable at line 132 or by checking `msg.time?.completed`). All completed messages have stable heights.

**Files:** `components/MessageList.tsx`

### 5.5 Input / Composer UX

**Severity: Critical**

**What:** No cursor movement within the input line. Characters are appended at the end only (`value + input` at line 339). Backspace deletes from the end only (`value.slice(0, -1)` at line 317). No left/right arrow handling for cursor position. No Ctrl+A/E for home/end. No Ctrl+W for word deletion. No multi-line input support.

**Why it's a problem:** For a coding tool, users frequently need to edit the middle of their prompt, paste multi-line content (error messages, code snippets, specifications), and navigate their input. Append-only input is unacceptable for production use. This is the single most user-facing deficiency.

**Root cause:** No `cursor` state variable exists in Composer.tsx. The component was built as a simple append-only input and never upgraded.

**Fix:**
- Add `cursor` state variable tracking position within `value`
- Implement left/right arrow cursor movement
- Ctrl+A (home), Ctrl+E (end), Ctrl+W (delete word back)
- Backspace and Delete at cursor position
- Alt+Enter or Ctrl+J for newline insertion (multi-line)
- Render multi-line input by splitting on `\n`
- Extract input logic into a `useTextInput` hook to manage complexity

**Files:** `components/Composer.tsx` (needs major refactor)

### 5.6 Keyboard Interaction

**Severity: Medium**

**What:** Arrow keys are context-dependent: Up/Down do history navigation when idle, scroll when generating. Two separate `useInput` blocks in Composer (lines 181-188 for generating, 191-371 for idle) with the active guard being the `generating` state.

**Why it's a problem:** The user must know whether the agent is generating to predict what Up arrow does. The placeholder text changes appropriately ("Generating... (arrows scroll)" vs "Type a message..."), which is good. But the visual distinction could be stronger.

**Root cause:** Intentional context-dependent behavior, handled correctly in code but with minimal visual signaling.

**Fix:** The placeholder already communicates mode. Enhance by making the entire input row visually distinct when generating vs idle -- the spinner is a start, but dimming the entire composer area during generation would make the mode unmistakable.

**Files:** `components/Composer.tsx`

### 5.7 Navigation

**Severity: Medium**

**What:** No in-session search. No message jumping. Scroll-only navigation with 5-row (keyboard) or 3-row (mouse) steps. Ctrl+Up/Down for jump to top/snap to bottom.

**Why it's a problem:** In a 50-message session, scrolling at 5 rows per keystroke to find a specific tool call or error takes many keystrokes. No way to search within the conversation.

**Root cause:** Not implemented -- no search component or search state exists in the codebase.

**Fix:** Add Ctrl+F search overlay that filters/highlights matching messages. Jump between matches with Enter/Shift+Enter. Lower priority than input fixes but high value for power users.

**Files:** New component + `MessageList.tsx` + `store.ts`

### 5.8 Discoverability

**Severity: Medium**

**What:** StatusBar shows two hardcoded hint strings at line 16 -- one for generating, one for idle. No first-run experience. Command palette (Ctrl+K) exists but is not discoverable without memorization.

**Why it's a problem:** New users see a blank prompt and don't know what's available beyond typing. The command palette is one of the most useful features but requires prior knowledge.

**Root cause:** `StatusBar.tsx:16` has static hint logic that only switches on `generating` boolean.

**Fix:**
- Make StatusBar hints fully context-sensitive (different when dialog open, when permission pending, when scrolled up, when sidebar open)
- Consider a one-time "Press Ctrl+K for commands" hint on first launch
- Store `hasSeenFirstRun` flag in prefs

**Files:** `components/StatusBar.tsx`, `store.ts` (add pref)

### 5.9 Visual Hierarchy

**Severity: High**

**What:** Everything is approximately the same visual weight. Header text, message text, tool call text, status text -- all rendered at similar brightness, size, and color saturation.

**Why it's a problem:** No scanability. The eye must read linearly to find anything. In a conversation with interspersed tool calls, the user can't distinguish the "shape" of the conversation at a glance.

**Root cause:** No systematic use of dim/normal/bold across the component tree. Each component uses `color={theme.text}` or `color={theme.subtext}` inconsistently.

**Fix:** Implement the 3-weight system consistently:
- User input: `color={theme.text}` with bold cyan left border (already partly done)
- Assistant text: `color={theme.text}` normal weight (current)
- Tool calls: `color={theme.subtext}` or `dimColor` for the entire ToolPart
- Metadata (footer, timestamps, token counts): `color={theme.overlay}` (already done correctly)

**Files:** `components/parts/ToolPart.tsx`, `components/AssistantMessage.tsx`, `components/UserMessage.tsx`

### 5.10 Density & Whitespace

**Severity: Medium**

**What:** UserMessage has 4+ rows of overhead for 1-line input: marginTop=1 (from AssistantMessage/UserMessage), border, paddingLeft=2, nested Box with paddingLeft=1, then the actual text. Three levels of Box nesting in UserMessage (outer Box > inner Box > innermost Box with flexDirection="column").

**Why it's a problem:** In a 20-message session, 60-80+ rows are pure overhead (margins, padding, nesting). With typical 50-row terminal, that's more than a full screen of wasted space.

**Root cause:** Deep Box nesting in UserMessage.tsx (3 levels) and generous padding values.

**Fix:** Flatten the nesting. UserMessage can be: `<Box marginTop={1} borderLeft borderColor={cyan}> <Text>• {text}</Text> </Box>` -- 2 rows for single-line input (1 margin + 1 content).

**Files:** `components/UserMessage.tsx`, `components/AssistantMessage.tsx`

### 5.11 Color / Borders / Separators

**Severity: Low**

**What:** The separator between message list and composer is `"─".repeat(width)` in `theme.surface1` (Composer.tsx:420). Tool bodies use `borderStyle="round"` (ToolPart.tsx:85,91). Message borders use `borderLeft` only. Three different border conventions in one UI.

**Why it's a problem:** The `borderStyle="round"` on tool output doesn't match any other visual pattern. Inconsistent border language creates visual noise.

**Root cause:** Different components chose different border styles independently.

**Fix:** Standardize on `borderLeft` for hierarchy indicators and simple `"─"` separators. Drop `borderStyle="round"` on tool output; use `borderLeft={true} borderColor={theme.surface0}` for consistency with the message border pattern.

**Files:** `components/parts/ToolPart.tsx`

### 5.12 Status / Error / Loading Feedback

**Severity: Medium**

**What:** Errors in assistant messages show in a red-bordered box (AssistantMessage.tsx:78-95). The "Connecting..." loading state (SessionScreen.tsx:96-100) is a centered Text element. Toasts stack at the top of MessageList via `ToastOverlay.tsx`.

**Why it's a problem:** Toast positioning (top of MessageList) can overlap with the scroll indicator (also top-right of MessageList at lines 239-243). Both use `position="absolute"`.

**Root cause:** `ToastOverlay` and scroll indicator compete for the same absolute position space.

**Fix:** Move toasts to overlay on top of the status bar area, or use a dedicated toast region that doesn't conflict with scroll indicators. Consider rendering the toast layer at the SessionScreen level rather than inside the MessageList's viewport.

**Files:** `components/ToastOverlay.tsx`, `screens/SessionScreen.tsx`

### 5.13 Responsiveness in Smaller Terminals

**Severity: Medium**

**What:** The sidebar is 32 columns wide (hardcoded `SIDEBAR_WIDTH = 32` at SessionScreen.tsx:69). With sidebar open in an 80-column terminal, the main area shrinks to 48 columns -- very tight for code output.

**Why it's a problem:** Many terminal users run at 80-100 columns. The sidebar steals 32-40% of the width.

**Root cause:** Fixed sidebar width with no responsive breakpoints.

**Fix:** Auto-hide sidebar below 120 columns. Or redesign it as an overlay that replaces (not sits alongside) the message list when toggled.

**Files:** `screens/SessionScreen.tsx`, `components/Sidebar.tsx`

### 5.14 Code Organization

**Severity: High**

**What:** `Composer.tsx` at 443 lines mixes: text editing logic, menu state management (slash + @mention), animation timers (spinner, caret), server-append handling, file attachment management, and rendering. `store.ts` at 631 lines has 42 actions mixing pure state transitions with network calls (`sendPrompt`, `loadMessages`, `createSession`, `setProviderApiKey`, `oauthAuthorize`, etc.).

**Why it's a problem:** Difficult to test, maintain, and reason about. The Composer is a mini-application embedded in a component. The store conflates state management with API orchestration.

**Root cause:** Organic growth without extraction boundaries.

**Fix:**
- Extract `useTextInput(initialValue)` hook from Composer: cursor, editing, history
- Extract `useMentions(client)` hook: search, selection
- Extract `useSlashCommands(commands)` hook: filtering, selection
- Move network-calling actions from store to a service layer. Store actions should be pure state transitions.

**Files:** `components/Composer.tsx`, `store.ts`

### 5.15 State Management

**Severity: High**

**What:** Single Zustand store with 49 fields. Every `set()` call creates a new state object and triggers all subscribers. 14 `useAppStore()` calls in SessionScreen alone. Network actions mixed with state transitions. Binary-search upsert pattern repeated 8 times.

**Why it's a problem:** During streaming, `appendPartDelta` calls `set()`, which triggers evaluation of all 14 selectors in SessionScreen. Most return stable references (e.g., `s => s.sendPrompt` is a stable function), but the selector evaluation itself has cost at 20Hz.

**Root cause:** Single-store architecture with all concerns mixed.

**Fix:** Split into 3 stores:
1. **`useStreamStore`**: messages, parts, composerStatus, sessionStatus, sessionDiff, permissions, questions, collapsedTools, scrollPos -- the streaming hot path
2. **`useAppStore`**: client, sessions, providers, agents, commands, config, lsp, mcp, vcs, syncStatus -- bootstrap data that changes rarely
3. **`useUIStore`**: route, dialogs, toasts, currentThemeName, currentModel, currentAgent, recentModels, mode, showThinking, promptHistory, promptStash, frecency -- UI state

**Files:** `store.ts` (split into 3 files)

### 5.16 Rendering Performance

**Severity: High**

**What:** No virtualization -- all messages rendered in React tree. Height estimation O(n) per frame during streaming. No `React.memo` on UserMessage/AssistantMessage/ToolPart. `useSessionParts` creates new object reference on every delta.

**Why it's a problem:** Performance degrades linearly with conversation length. A 100-message session renders 100+ message components plus their children every 50ms during streaming.

**Root cause:** The message rendering loop at `MessageList.tsx:248-263` iterates all messages unconditionally with `.map()`.

**Fix:**
1. Windowed rendering: only render viewport + 2-message buffer
2. Height cache: `Map<messageID, number>` for completed messages
3. `React.memo` on UserMessage, AssistantMessage, ToolPart
4. Stabilize `useSessionParts` return value for unchanged messages

**Files:** `components/MessageList.tsx`, `components/UserMessage.tsx`, `components/AssistantMessage.tsx`, `components/parts/ToolPart.tsx`

### 5.17 Maintainability / Extensibility

**Severity: Medium**

**What:** `as any` type casts in 6+ locations. Dead sidebar code. No error boundaries. The SDK types don't include `parentID`, `synthetic`, `ignored`, `modelID`, `finish`, `error`, `mode`, `tokens` fields that exist at runtime.

**Why it's a problem:** Type casts hide bugs and make refactoring dangerous. Dead code confuses contributors. Missing error boundaries mean a single render error in any message component crashes the entire TUI.

**Root cause:** SDK types are auto-generated and don't include all runtime fields. Sidebar was added aspirationally without activation.

**Fix:**
- Create extended type definitions: `type SessionExt = Session & { parentID?: string }`, `type MessageExt = Message & { modelID?: string; finish?: string; error?: {...}; mode?: string; ... }`
- Either activate sidebar with proper keyboard focus management or remove it
- Add React error boundaries around MessageList and BottomDock

**Files:** New `types.ts`, `screens/SessionScreen.tsx`, `components/UserMessage.tsx`, `components/AssistantMessage.tsx`, `components/Sidebar.tsx`

---

## 6. Ideal Target UX for BetterCode

### Starting BetterCode

The terminal fills with a **dark-background frame**: a header bar (mantle background) with the project name and git branch in subdued color, and a status bar at the bottom (matching mantle background) showing the model and agent mode. Between them, a clean canvas with a focused input prompt.

If this is a new session, the user sees an empty message area with a subtle placeholder: "Ask anything. / for commands. @ for files." The hint disappears after the first message.

If resuming a session, the user sees the last messages with scroll position restored to where they left off.

The bootstrap "Connecting..." state should be a slim indicator in the header bar (not a centered overlay that replaces the entire screen). The frame renders immediately; content fills in as bootstrap completes.

### Reading Agent Responses

Assistant messages render with a subtle diamond lead character (◆) in a muted color, marking the start. Text flows in normal weight. The left border is present but very low-contrast (surface2) -- structural, not decorative.

Completed tool calls appear as **single-line summaries** between text paragraphs: a dim status icon (✓), a semantic description ("Read store.ts - 142 lines"), and duration. They're visually subordinate to the text -- using `color={theme.subtext}` rather than `color={theme.text}`. The user can expand any tool call to see its output.

The footer (model, tokens, duration) appears only on the last message or when a message is fully completed. It's dim (`color={theme.overlay}`) and serves as a natural conversation terminator.

### Following Streaming Output

During streaming, the input prompt shows a spinning braille indicator with "Generating..." text, all dimmed. The message area pins to the bottom (sticky scroll). New text appears smoothly at the bottom of the viewport.

Tool calls during streaming show as animated one-liners: "◎ reading src/store.ts..." with a subtle yellow running indicator. No JSON input body. No expanding box. Just a compact status line that the eye can follow without distraction.

When a tool completes mid-stream, it smoothly transitions to the collapsed completed state: "✓ Read src/store.ts (142 lines) · 0.3s". No layout jump because both running and completed states are single-line.

The header shows "generating" status in yellow. The StatusBar shows context-appropriate hints: "↑↓ scroll · e: toggle tools · ctrl+c: abort".

### Understanding Tool Calls

By default, all completed tool calls are one-line summaries. The user presses a key (Enter or arrow) to expand one. "e" toggles all tool visibility for the current message.

Expanded tool output shows in a subtle indented block with `borderLeft` in surface0 color, consistent with the message border pattern. Long output is truncated at 30 lines with a "... N more lines" indicator.

Error tool calls are always expanded automatically, with red left border. The error message is immediately visible.

When an assistant message has 5+ consecutive tool calls, they can be further grouped into a single summary line ("5 tools executed: 3 reads, 1 write, 1 exec · 2.1s") that expands to show individual tool lines.

### Inspecting Detailed Tool Output

When the user needs to see what a tool did, they navigate to the tool line and expand it. The tool expands in-place, pushing content below it down. The expansion is immediate (no animation needed in terminal).

For different tool types, the output uses appropriate formatting:
- File read tools: the content with line count
- Bash/shell tools: output with `$` prompt prefix aesthetic
- Write/edit tools: diff view when available
- Search tools: result list with file paths

### Entering Prompts

The composer is a premium, cursor-aware input:
- Cursor can be positioned anywhere with left/right arrows
- Ctrl+A/E for home/end, Ctrl+W for delete word backward
- Alt+Enter for newline insertion (multi-line editing)
- Up/Down navigates history when input is empty or cursor is at first/last line
- @ triggers file search inline with fuzzy matching
- / triggers command menu with prefix filtering
- Tab completes the current menu suggestion
- The caret blinks when idle (530ms), stops when typing
- Ctrl+U clears input, Ctrl+X stashes, Ctrl+Y restores stash
- Shift+Tab cycles agent mode (plan/build)

### Navigating Previous Content

Shift+Up/Down scrolls the message area by 5 rows. Mouse wheel scrolls by 3 rows. Page Up/Down scrolls by a full page. Ctrl+Up/Down jumps to top/bottom.

When scrolled up, a breadcrumb appears at the top-right: "Message 12/47 · 3 min ago". Ctrl+Down snaps back to bottom and the breadcrumb disappears.

Ctrl+F opens a search bar that highlights matching text in messages. Enter/Shift+Enter jumps between matches.

### Handling Confirmations / Interrupts / Errors

Permission prompts appear immediately above the composer (current behavior is correct). They show the tool name, the action, and the patterns. y/a/n are the quick keys. The StatusBar updates to show permission-specific hints.

Errors show inline in the conversation with a red left border. Network/connection errors show in a toast that auto-dismisses. The reconnection state is visible in the header.

Ctrl+C during generation aborts cleanly. The message shows "interrupted" in the footer. The UI immediately returns to the idle input state.

### Long Coding Sessions

After 20+ messages, the UI remains responsive because:
- Completed messages are height-cached and memoized (not re-rendered)
- Only viewport-visible messages are in the React tree (windowed rendering)
- Height estimates are cached for all completed messages
- Store splitting prevents streaming updates from triggering UI selectors

A session token counter in the StatusBar shows cumulative usage. As context approaches known limits, the counter color transitions from neutral to yellow to red.

The session list (Ctrl+S) allows quick switching with frecency sorting. The `/compact` command summarizes older messages to reduce context usage. Compaction markers are visible in the conversation.

---

## 7. Recommended UI Architecture

### Component Boundaries

```
App
├── ThemeProvider
│   └── ScreenRouter (route-based)
│       ├── HomeScreen
│       ├── PluginScreen
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
│           │           ├── CompactionPart
│           │           └── MessageFooter
│           ├── ToastLayer           # Absolute overlay, non-conflicting
│           ├── PermissionBar        # Conditional, above composer
│           ├── ComposerBar          # Fixed height
│           │   ├── AttachmentRow    # Conditional
│           │   ├── StashIndicator   # Conditional
│           │   ├── MentionOverlay   # Absolute above input
│           │   ├── SlashOverlay     # Absolute above input
│           │   ├── Separator        # ─── line
│           │   └── InputLine        # Uses useTextInput hook
│           └── StatusBar            # Fixed 1 row, backgroundColor={mantle}
└── DialogOverlay                    # Absolute full-screen when dialog active
```

### Layout Primitives

- **`FrameBar`**: 1-row component with `backgroundColor={theme.mantle}` -- reused for Header and StatusBar. Creates the "window frame" effect.
- **`MessageRow`**: Generic wrapper with left border + padding + flexShrink=0 -- reused for user and assistant messages. Takes `borderColor` as prop.
- **`CollapsibleSection`**: Toggle pattern with one-line summary + expandable body -- reused for tool calls, reasoning, and long output blocks.

### Reusable Abstractions

- **`useTextInput({ initialValue, onSubmit })`**: Returns `{ value, cursor, insert, delete, home, end, clear, handlers }`. Extracted from Composer. Handles cursor position, character insertion at cursor, deletion at cursor, home/end, word operations, history navigation, and multi-line support.
- **`useListNavigation(items, options)`**: Returns `{ selectedIndex, handlers }`. Reused across CommandPalette, SessionList, ModelPicker, AgentPicker, McpDialog, ThemePickerDialog, SlashMenu, MentionMenu.
- **`useSearch(fetchFn, debounceMs)`**: Returns `{ query, setQuery, results, loading, select }`. Reused for @mentions, command filtering, and in-session search.
- **`HeightCache`**: Module-scoped `Map<messageID, { height: number, partsVersion: number }>`. Caches height estimates for completed messages. Only recomputes when `partsVersion` (parts count + last text length) changes.

### Message Rendering Pipeline

1. **Store** delivers `messages[]` and `parts{}` for current session via session-scoped selectors
2. **MessageViewport** computes visible range using cached heights + current scroll offset
3. **VirtualWindow** renders only messages in range `[visible_start - 2, visible_end + 2]`
4. **Each message component** receives `message` and `parts[]` props, is `React.memo`'d
5. **Parts** are rendered by type dispatch inside each message component
6. **ToolCallLine** is the default (collapsed) view; **ToolCallDetail** renders when user expands
7. **MarkdownRenderer** results are memoized by text content via `useMemo([text])`

### Tool Call Rendering Strategy

Three states, three consistent visuals:

**Running** -- Single animated line:
```
  ◎ reading src/store.ts...                              1.2s
```

**Completed (collapsed, default)** -- Single dim line:
```
  ✓ Read src/store.ts (142 lines)                        0.3s
```

**Completed (expanded)** -- Summary line + indented body:
```
  ✓ Read src/store.ts (142 lines)                        0.3s
  │ import React from "react"
  │ import { Box, Text } from "ink"
  │ ...
  │ ... 112 more lines
```

**Error (always expanded)** -- Red border, error visible:
```
  ✗ Write /etc/hosts                                     0.1s
  │ EACCES: permission denied
```

The key insight: running and completed-collapsed are both single-line, so the transition from running to completed causes zero layout shift.

### Event / State Model

**Three Zustand stores:**

1. **`useStreamStore`** (hot path, ~20Hz during streaming):
   - State: `messages`, `parts`, `composerStatus`, `sessionStatus`, `sessionDiff`, `permissions`, `questions`, `collapsedTools`, `scrollPos`, `messagesLoaded`
   - Actions: `upsertMessage`, `removeMessage`, `upsertPart`, `removePart`, `appendPartDelta`, `toggleToolCollapse`, `expandAllTools`, `collapseAllTools`, `upsertPermission`, `removePermission`, `upsertQuestion`, `removeQuestion`, `setScrollPos`

2. **`useAppStore`** (bootstrap data, changes rarely):
   - State: `client`, `syncStatus`, `serverUrl`, `directory`, `serverHeaders`, `sessions`, `providers`, `providerDefaults`, `providerConnected`, `providerAuth`, `agents`, `commands`, `config`, `lsp`, `mcp`, `vcs`, `currentSessionID`
   - Actions: `upsertSession`, `removeSession`, `loadMessages`, `setClient`, `setSyncStatus`

3. **`useUIStore`** (UI state, changes on user interaction):
   - State: `route`, `dialogs`, `toasts`, `currentThemeName`, `currentModel`, `currentAgent`, `recentModels`, `mode`, `showThinking`, `promptHistory`, `promptStash`, `frecency`, `composerAppend`
   - Actions: `navigate`, `pushDialog`, `popDialog`, `setTheme`, `setCurrentModel`, `setCurrentAgent`, `setMode`, `setShowThinking`, `addToast`, `removeToast`, `pushPromptHistory`, `setPromptStash`, `trackFrecency`, `setComposerAppend`

**Service layer** (separate from stores):
- `sessionService.ts`: `sendPrompt()`, `createSession()`, `deleteSession()`, `forkSession()`, etc.
- `providerService.ts`: `setApiKey()`, `oauthAuthorize()`, `refreshProviders()`, etc.
- `mcpService.ts`: `connect()`, `disconnect()`, `refresh()`, etc.

Each service function calls the SDK client, then dispatches to the appropriate store.

### Styling / Theming Strategy

Keep current theme system -- it's well-designed. Additions:
- Semantic weight map: `const WEIGHT = { primary: 'text', secondary: 'subtext', tertiary: 'overlay' } as const`
- Frame background: `theme.mantle` for Header/StatusBar
- Standardize on `borderLeft` only for hierarchy. No `borderStyle="round"`. Full borders only for code blocks.
- Color usage guide: green=success, red=error, yellow=warning/in-progress, cyan=user/interactive, overlay/subtext=metadata

### Performance Strategy

1. **Delta batching** (50ms) -- keep as-is, well-implemented
2. **Height cache** -- `Map<messageID, { height, version }>`, invalidate only for in-progress message. Version = parts.length + last text part length.
3. **Virtual window** -- render only viewport + 2-message buffer above/below. Use spacer `<Box height={N}>` elements for scroll math.
4. **React.memo** on UserMessage, AssistantMessage, ToolPart, TextPart
5. **Stable selectors** -- avoid creating new objects/arrays in selectors. Return store references directly.
6. **Debounced markdown lexing** -- optional: during streaming, show raw text; lex on 200ms quiet period or message completion
7. **Store splitting** -- 3 stores isolate update frequencies

### What Should Be Generalized

- **List navigation** (used in CommandPalette, SessionList, ModelPicker, AgentPicker, McpDialog, ThemePickerDialog, SlashMenu, MentionMenu)
- **Text input** (used in Composer, QuestionPrompt, ProviderDialog, SessionListDialog rename mode)
- **Collapsible section** (used for tool calls, reasoning, long output)
- **Dialog lifecycle** (push/pop/dismiss pattern)
- **Frecency scoring** (already generalized, good)

### What Should Remain Specialized

- **MessageList scrolling logic** -- unique complex behavior with sticky scroll, height estimation, virtualization
- **ToolPart semantic summary** -- domain-specific heuristics for tool name -> human description
- **ProviderDialog multi-step auth** -- unique state machine
- **SSE event dispatch** -- one-off, already well-structured in useSDK

---

## 8. Concrete Improvement Plan

### Phase 1: Highest Leverage Improvements

These changes deliver the most visible quality improvement with the least risk.

#### 1.1 Visual Hierarchy: Header & StatusBar Background
- **Impact:** High -- immediately makes the UI feel framed and professional
- **Effort:** 30 minutes
- **Risk:** None
- **Dependency:** None
- **Type:** UX-only

#### 1.2 Visual Hierarchy: 3-Weight Text System
- **Impact:** High -- transforms scanability of the conversation
- **Effort:** 2-3 hours
- **Risk:** Low -- theme colors already exist
- **Dependency:** None
- **Type:** UX-only

#### 1.3 Composer Cursor Support
- **Impact:** Critical -- table-stakes for production use
- **Effort:** 4-6 hours
- **Risk:** Medium -- input handling is delicate
- **Dependency:** None
- **Type:** Both UX and code

#### 1.4 Tool Call Collapse Logic Inversion
- **Impact:** High -- reduces noise during generation, improves readability
- **Effort:** 2 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Both UX and code

#### 1.5 Context-Sensitive StatusBar Hints
- **Impact:** Medium -- improves discoverability significantly
- **Effort:** 2 hours
- **Risk:** None
- **Dependency:** None
- **Type:** Both

### Phase 2: Structural Improvements

These changes improve architecture and performance, enabling future work.

#### 2.1 Height Cache for Completed Messages
- **Impact:** High -- eliminates O(n) markdown lex per frame
- **Effort:** 3-4 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Code-only

#### 2.2 React.memo on Message Components
- **Impact:** Medium-High -- prevents re-rendering completed messages
- **Effort:** 2 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Code-only

#### 2.3 Composer Refactor: Extract Hooks
- **Impact:** Medium -- improves maintainability, enables multi-line
- **Effort:** 6-8 hours
- **Risk:** Medium
- **Dependency:** 1.3
- **Type:** Code-only

#### 2.4 Fix Type Casts
- **Impact:** Medium -- reduces maintenance hazard
- **Effort:** 3-4 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Code-only

#### 2.5 Store Splitting
- **Impact:** High -- isolates streaming hot path
- **Effort:** 8-12 hours
- **Risk:** Medium-High
- **Dependency:** None (but large scope)
- **Type:** Code-only

#### 2.6 Windowed Message Rendering
- **Impact:** High -- O(1) rendering regardless of conversation length
- **Effort:** 8-12 hours
- **Risk:** Medium
- **Dependency:** 2.1
- **Type:** Code-only

### Phase 3: Polish & Advanced Features

#### 3.1 Multi-Line Composer Input
- **Impact:** High for coding workflow
- **Effort:** 4-6 hours
- **Risk:** Medium
- **Dependency:** 2.3
- **Type:** Both

#### 3.2 Sidebar Activation or Redesign
- **Impact:** Medium
- **Effort:** 4-6 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Both

#### 3.3 In-Session Search (Ctrl+F)
- **Impact:** Medium -- power user feature
- **Effort:** 6-8 hours
- **Risk:** Low
- **Dependency:** None
- **Type:** Both

#### 3.4 Session Token Counter
- **Impact:** Low-Medium
- **Effort:** 2 hours
- **Risk:** None
- **Dependency:** None
- **Type:** Both

#### 3.5 Tool Summary Grouping
- **Impact:** Medium
- **Effort:** 4-6 hours
- **Risk:** Medium
- **Dependency:** 1.4
- **Type:** Both

#### 3.6 Error Boundaries
- **Impact:** Medium (reliability)
- **Effort:** 2 hours
- **Risk:** None
- **Dependency:** None
- **Type:** Code-only

#### 3.7 Scroll Position Breadcrumbs
- **Impact:** Low
- **Effort:** 2-3 hours
- **Risk:** None
- **Dependency:** None
- **Type:** UX-only

---

## 9. Quick Wins

Changes that noticeably improve the product and can each be done in under 2 hours. Good first PR candidates.

1. **Header/StatusBar background** -- Add `backgroundColor={theme.mantle}` to both `<Box>` elements. ~15 minutes. Immediately makes the UI look framed and professional.
   - Files: `Header.tsx:19`, `StatusBar.tsx:20`

2. **Tool call dim treatment** -- Change ToolPart text from `color={theme[stat.color]}` to `color={theme.subtext}` for the title text, keeping only the status icon in the status color. ~30 minutes.
   - Files: `parts/ToolPart.tsx:105`

3. **Simplify tool icons** -- Reduce `kind()` from 6 icons to 4: `◇` (read), `✎` (write/edit), `$` (execute/bash), `⬡` (mcp). Merge glob/grep/search into read. ~15 minutes.
   - Files: `parts/ToolPart.tsx:57-65`

4. **Prefer state.title for tool summaries** -- Line 75 already checks for `state.title`. Make it the primary display, falling back to `span()` only when title is absent. ~15 minutes.
   - Files: `parts/ToolPart.tsx:75`

5. **Invert tool collapse default** -- Change line 73 from `state.status !== "completed" || collapsed === false` to `collapsed === false`. All tools start collapsed; running tools show title-only (no JSON body). ~15 minutes.
   - Files: `parts/ToolPart.tsx:73`

6. **Dynamic StatusBar hints** -- Extend hint logic to include: dialog open, permission pending, scrolled up. ~45 minutes.
   - Files: `StatusBar.tsx:16` (needs additional props or store subscriptions)

7. **Drop round borders on tool output** -- Replace `borderStyle="round"` with `borderLeft={true} borderColor={theme.surface0}` for consistency. ~15 minutes.
   - Files: `parts/ToolPart.tsx:85,91`

8. **React.memo on UserMessage and AssistantMessage** -- Wrap both components. Verify prop stability (no inline object creation in MessageList's `.map()`). ~30 minutes.
   - Files: `UserMessage.tsx`, `AssistantMessage.tsx`

9. **Fix `(sess as any).parentID`** -- Create `type SessionExt = Session & { parentID?: string }` and use it in SessionScreen. ~30 minutes.
   - Files: New type definition, `SessionScreen.tsx:46`

10. **Remove or activate sidebar** -- Either wire `active` to a real focus state (allowing keyboard input when sidebar is open) or remove the dead code entirely. ~30 minutes.
    - Files: `SessionScreen.tsx:137`, `Sidebar.tsx`

---

## 10. Suggested Redesign Patterns

### 10.1 Top Message/Tool Area

```
┌─ bettercode ── main ── 3 sessions ──────────── ● ready ─┐  ← mantle bg
│                                                           │
│ • fix the login bug in auth.ts                            │  ← cyan border
│                                                           │
│ ◆ I'll look at the auth module and fix the login bug.     │  ← surface2 border
│                                                           │
│   ✓ Read auth.ts (89 lines)                        0.2s  │  ← subtext color
│   ✓ Read auth.test.ts (145 lines)                  0.3s  │  ← subtext color
│   ✎ Write auth.ts                                  0.1s  │  ← subtext color
│                                                           │
│   I've fixed the issue. The problem was a missing null    │  ← text color
│   check on the user object at line 42.                    │
│                                                           │
│   build · claude-sonnet-4-20250514 · 3.2s · 1.2k tokens        │  ← overlay color
│                                                           │
├───────────────────────────────────────────────────────────┤
│ › _                                                       │
├─ plan │ claude-sonnet-4-20250514 │ ctrl+k: cmds shift+tab: agent ─┤  ← mantle bg
└───────────────────────────────────────────────────────────┘
```

Key changes from current:
- Header and StatusBar have mantle background
- Tool calls are visually dim (subtext color) and single-line
- Clear visual weight difference between user input (bold, cyan) and tool calls (dim, subtext)
- Footer only on last/completed message

### 10.2 Bottom Input / Composer Area

**Idle state:**
```
─────────────────────────────────────────────────────
› Type a message... (/ commands, @ files)█
```

**Generating state:**
```
─────────────────────────────────────────────────────
⠹ Generating... (↑↓ scroll · ctrl+c abort)
```

**With attachments:**
```
 auth.ts  utils.ts 
─────────────────────────────────────────────────────
› fix the failing test in█
```

**With stash indicator:**
```
stash: fix the login bug i... (ctrl+y to restore)
─────────────────────────────────────────────────────
› █
```

**Multi-line (future):**
```
─────────────────────────────────────────────────────
│ here's the error I'm seeing:
│ TypeError: Cannot read property 'user'
│ of undefined at line 42█
```

### 10.3 Tool Call Cards

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
  │ import { useAppStore } from "../store"
  │ ...
  │ ... 108 more lines
```

**Error (always expanded):**
```
  ✗ Write /etc/hosts                                     0.1s
  │ EACCES: permission denied
  │ The file is read-only.
```

### 10.4 Collapsible Tool Group (for dense turns)

**Collapsed:**
```
  ▸ 5 tools (3 reads, 1 write, 1 exec)                  2.1s
```

**Expanded:**
```
  ▾ 5 tools (3 reads, 1 write, 1 exec)                  2.1s
  ✓ Read auth.ts (89 lines)                              0.2s
  ✓ Read auth.test.ts (145 lines)                        0.3s
  ✓ Read utils.ts (67 lines)                             0.1s
  ✎ Write auth.ts                                        0.4s
  $ bun test auth.test.ts                                1.1s
```

### 10.5 Status Line Variants

**Idle:**
```
plan │ claude-sonnet-4-20250514 │ 1.2k tok │ ctrl+k: cmds · ctrl+s: sessions · shift+tab: agent
```

**Generating:**
```
plan │ claude-sonnet-4-20250514 │ 1.2k tok │ ↑↓ scroll · e: tools · ctrl+c: abort
```

**Permission pending:**
```
plan │ claude-sonnet-4-20250514 │ PERMISSION │ y: allow · a: always · n: deny
```

**Scrolled up:**
```
plan │ claude-sonnet-4-20250514 │ msg 12/47 │ ↑↓ scroll · ctrl+↓: snap bottom
```

### 10.6 Scroll Indicator (top-right when scrolled up)

```
                                         ↑ msg 12/47 · 3m ago
```

### 10.7 Inline Error States

**Network/connection error (toast):**
```
  ⚠ Connection lost. Reconnecting in 4s...
```

**Model error (in message flow):**
```
│ ✗ Rate limit exceeded
│ │ Retrying in 30s. You can switch models with ctrl+k → model.
```

### 10.8 Diff/Patch Output (in expanded tool view)

```
  ✎ Write src/auth.ts                                    0.4s
  │  @@ -41,3 +41,5 @@
  │   function login(user) {
  │  -  return db.find(user)
  │  +  const result = db.find(user)
  │  +  if (!result) throw new AuthError('User not found')
  │  +  return result
  │   }
```

### 10.9 Command Output Blocks (in expanded tool view)

```
  $ bun test auth.test.ts                                1.8s
  │ ✓ login should authenticate valid user (12ms)
  │ ✓ login should reject invalid user (8ms)
  │ ✓ login should handle missing user (5ms)
  │ 3 pass, 0 fail
```

### 10.10 Session Metadata in Header

**Basic (current-like):**
```
bettercode ── main ── 3 sessions ── ● ready
```

**Enhanced (with session context):**
```
bettercode ── main ── auth-fix (12 msgs · 1.2k tok) ── ● ready
```

---

## 11. Performance & Implementation Review

### 11.1 Rerender Risks

| Risk | Severity | Location | Cause |
|------|----------|----------|-------|
| All messages re-rendered on any part delta | **High** | `MessageList.tsx:248-263` | No React.memo on UserMessage/AssistantMessage; the `.map()` creates new JSX every render |
| Height estimation re-runs for all messages | **High** | `MessageList.tsx:144-147` | `totalHeight` useMemo depends on `parts` which is a new object ref every flush |
| 14 selector evaluations per store update | **Medium** | `SessionScreen.tsx:22-30` | Single store, many subscriptions |
| MarkdownRenderer re-lexes on every delta | **Medium** | `MarkdownRenderer.tsx` | `useMemo([text])` where text changes per flush for streaming message |
| Spinner interval fires during idle | **Low** | `Composer.tsx:61-68` | Properly guarded by `generating` check, no issue |

### 11.2 Excessive State Propagation

- `useAppStore((s) => s.sendPrompt)` in SessionScreen -- subscribes to entire store to get a stable function reference. The function IS stable (created once), but the selector runs on every store update to verify this.
- `useAppStore((s) => s.collapsedTools)` in MessageList -- subscribes to the entire collapsedTools object, not just the relevant session's tools. Any tool toggle in any session triggers a selector evaluation.
- `useSessionParts` at line 101: `useAppStore((s) => s.parts)` subscribes to ALL parts across ALL sessions. The `useMemo` filter at lines 103-111 reduces re-renders but the subscription fires globally.

### 11.3 Unnecessary Component Churn

- `UserMessage` is NOT memoized. Props (`parts`, `isQueued`) may be new references on every render cycle.
- `AssistantMessage` is NOT memoized. Gets new `parts` array every render from the `.map()` in MessageList.
- `ToolPart` is NOT memoized. Gets `part` prop from AssistantMessage's part array iteration.
- `MarkdownRenderer` uses `useMemo` internally but the component itself isn't memoized, so it still reconciles.

### 11.4 Layout Instability

- `dockHeight()` returns different values (4, 9, 11, or 15 rows) when permissions/questions/dialogs arrive, causing MessageList height to change mid-stream.
- ToastOverlay and scroll indicator both use `position="absolute"` at top of the MessageList viewport and can visually overlap.
- Sidebar toggle changes `mainWidth` from `columns` to `columns - 32`, reflowing all content including word-wrapped markdown.

### 11.5 Streaming Inefficiencies

- `appendPartDelta` in store.ts copies the parts array on every flush: `const next = [...arr]`, copies the part: `const part = { ...next[index] }`, copies the parts record: `{ ...prev.parts, [messageID]: next }`. Three object allocations per delta flush at 20Hz.
- These copies are correct for Zustand immutability semantics but could be optimized with targeted mutations (Zustand doesn't diff values; it only checks if `set()` was called).

### 11.6 Large List Rendering

- No virtualization. 100 messages = 100+ React component subtrees in the reconciliation tree.
- Each AssistantMessage may have 5-10 ToolPart children, each with their own collapsed/expanded state.
- At 100 messages with average 3 tool parts each, that's ~400+ components reconciled every 50ms during streaming.
- All components are rendered even though only ~10-20 rows are visible in the viewport.

### 11.7 Weak Memoization Boundaries

- The only `React.memo` in the message rendering pipeline is on `MessageList` itself (line 120).
- Inside MessageList, the `.map()` at line 248 creates new JSX for every message on every render.
- `useSessionParts` returns a new `out` record object every time any part in any message changes (because it builds a new Record in the useMemo at lines 103-111).

### Recommendations

#### Code-Level Optimizations

1. **Wrap UserMessage, AssistantMessage, ToolPart in React.memo.** Ensure props are referentially stable.
2. **Stabilize parts prop.** Pass `parts[msg.id]` directly from the store. The array reference is stable if no parts changed for that specific message.
3. **Height cache.** `Map<messageID, { height: number, version: number }>`. Version is `parts.length + lastTextPartLength`. Only recompute when version changes. Invalidate only for the in-progress message.
4. **Debounce markdown lexing during streaming.** During streaming, render raw text without markdown formatting. Lex on 200ms quiet period or message completion. Users are reading linearly during streaming; they don't need heading formatting while text is arriving.
5. **Targeted store mutations.** In `appendPartDelta`, consider mutating the parts array in place instead of spreading. Zustand doesn't diff values; it only checks if `set()` was called. Or use `immer` middleware for the streaming store only.

#### Architectural Changes

1. **Store splitting** into 3 stores (streaming, app, UI) as described in Section 7.
2. **Virtual window rendering** for MessageList -- calculate visible range from scroll offset and cached heights; render only visible + 2-message buffer.
3. **Service layer** for network calls -- extract from store actions into standalone async functions that call the client then dispatch to stores.

#### Measurement Ideas

- Add a `__DEV__` mode flag that logs render counts per component per second during streaming.
- Time `estimateHeight` calls across the full message list and log when total exceeds 10ms.
- Measure `appendPartDelta` → React render → Ink paint latency using `performance.now()` markers.
- Log total React node count per render frame to track component tree size.

#### Profiling Approach

- React DevTools Profiler works with Ink via `--inspect` flag. Attach to the Bun process.
- Add `<React.Profiler>` wrapper around MessageList with `onRender` callback to measure render time per frame.
- Instrument `appendPartDelta` with timing markers before/after `set()`.
- Compare performance with 5, 20, 50, 100 message sessions.

#### Rules for Future Contributors

1. **Never subscribe to the whole store.** Use granular selectors that return stable references.
2. **Always React.memo message-level components.** The message list is the performance-critical rendering path.
3. **Never create objects/arrays inside Zustand selectors.** Return store references directly. Use `useShallow` only when spreading is unavoidable.
4. **Cache any computation that depends on completed messages.** Completed messages are immutable -- their height, tokens, and rendered output never change.
5. **Test with 50+ message sessions.** Don't optimize for the 3-message demo case.
6. **Keep components under 200 lines.** Extract hooks for logic; keep components as renderers.

---

## 12. Production Readiness Checklist

### Usability
- [ ] Cursor-aware text input with left/right navigation, home/end, word deletion
- [ ] Multi-line input support (Alt+Enter or Ctrl+J for newline)
- [ ] Context-sensitive keyboard shortcut hints in StatusBar
- [ ] Progressive disclosure for tool calls (collapsed by default, semantic summaries)
- [ ] In-session search (Ctrl+F) with match highlighting
- [ ] Scroll position breadcrumbs when scrolled up
- [ ] First-run discoverability hint for command palette

### Consistency
- [ ] 3-weight visual hierarchy (bold/normal/dim) applied systematically
- [ ] Consistent border language (borderLeft only, no round/single mixing)
- [ ] Consistent color semantics (green=success, red=error, yellow=warning, cyan=interactive)
- [ ] Consistent spacing (uniform margins between messages)
- [ ] Consistent icon set (4 tool kinds, 4 status states = 8 total, not 10+)

### Reliability
- [ ] Error boundaries around MessageList and BottomDock
- [ ] Graceful handling of SDK connection loss with user-visible indicator
- [ ] No silent `.catch(() => {})` error swallowing -- at minimum log to console
- [ ] Session token tracking with visual context limit warnings
- [ ] Proper cleanup of intervals/subscriptions on unmount (already mostly done)

### Performance
- [ ] Height cache for completed messages (eliminate O(n) lex per frame)
- [ ] React.memo on all message-level components
- [ ] Windowed/virtualized message rendering (viewport + 2 buffer)
- [ ] Store splitting (streaming vs UI vs bootstrap)
- [ ] Debounced markdown lexing during active streaming
- [ ] Tested with 100+ message sessions without visible degradation

### Accessibility
- [ ] Screen reader-compatible output (semantic text, not decoration-heavy)
- [ ] High contrast theme option
- [ ] Keyboard-only navigation for all features (no mouse required)
- [ ] Clear focus indicators showing which region is active

### Maintainability
- [ ] No `as any` type casts (extended local types instead)
- [ ] All components under 200 lines
- [ ] Extracted hooks for shared logic (text input, list navigation, search)
- [ ] No dead code (sidebar either active or removed)
- [ ] Comprehensive store tests (existing tests are good; maintain as store splits)

### Observability
- [ ] Dev-mode render count logging
- [ ] Performance profiling hooks around critical render paths
- [ ] Error reporting to console (not silent catch)

### Extensibility
- [ ] Plugin system for custom tool renderers (future)
- [ ] Theme extensibility beyond built-in palettes
- [ ] Command registry extensibility (already good)
- [ ] Configurable keyboard shortcuts (future)

---

## 13. PR-Ready Backlog

### Theme: Visual Polish

#### PR-1: Frame the UI with Header/StatusBar backgrounds
- **Why:** Creates visual anchoring that immediately makes the UI feel like a framed application rather than free-floating text
- **Scope:** Add `backgroundColor={theme.mantle}` to Header and StatusBar outer Box elements
- **Files:** `components/Header.tsx`, `components/StatusBar.tsx`
- **Acceptance criteria:**
  - Header and StatusBar have distinct mantle background color
  - Content area visually sits "between" the frame bars
  - Works correctly across all 7 themes
  - No layout shift or height change

#### PR-2: Implement 3-weight visual hierarchy
- **Why:** Transforms scanability -- users can distinguish user input, agent text, and tool calls at a glance
- **Scope:** Apply consistent dim/normal/bold color treatment across message types
- **Files:** `components/parts/ToolPart.tsx`, `components/AssistantMessage.tsx`, `components/UserMessage.tsx`, `components/parts/TextPart.tsx`
- **Acceptance criteria:**
  - User messages are visually boldest (cyan border, text color)
  - Tool calls are visually dimmest (subtext color, only status icon colored)
  - Assistant text is normal weight (text color)
  - The conversation is scannable at a glance in any theme

#### PR-3: Simplify tool icons and use semantic summaries
- **Why:** Reduces cognitive load from 10 glyphs to ~7. Produces human-readable tool descriptions.
- **Scope:** Reduce `kind()` to 4 icons; prefer `state.title` for display text; clean up `span()` fallback
- **Files:** `components/parts/ToolPart.tsx`
- **Acceptance criteria:**
  - Tool icons: `◇` (read), `✎` (write/edit), `$` (execute/bash/shell), `⬡` (mcp)
  - Server-provided `state.title` is the primary display text when available
  - `span()` fallback produces cleaner output (e.g., filename not full path where possible)

#### PR-4: Standardize borders
- **Why:** Visual consistency -- removes orphan round border style
- **Scope:** Replace `borderStyle="round"` with `borderLeft={true}` in ToolPart
- **Files:** `components/parts/ToolPart.tsx`
- **Acceptance criteria:**
  - No `borderStyle="round"` anywhere in the TUI codebase
  - Tool output uses left-border indentation consistent with message borders
  - Error output retains red left border

### Theme: Tool Call UX

#### PR-5: Invert tool collapse logic
- **Why:** Running tools show noisy JSON input; completed tools hide useful output. This inverts the signal/noise ratio.
- **Scope:** Default all tools to collapsed (one-line summary). Running tools show status line only (no body). Errors always expanded.
- **Files:** `components/parts/ToolPart.tsx`, `store.ts` (collapsedTools state)
- **Acceptance criteria:**
  - Running tools: one-line "◎ reading file..." status with duration
  - Completed tools: one-line "✓ Read file (N lines)" summary with duration
  - Error tools: expanded with red border and error message
  - User can toggle any completed tool to see output
  - "e" key still toggles all tools for current message
  - Running-to-completed transition causes zero layout shift (both are single-line)

#### PR-6: Tool grouping summary for dense turns
- **Why:** Reduces noise when agent makes 5+ tool calls in a row
- **Scope:** When 3+ consecutive tool parts in an assistant message, optionally show a collapsible group summary
- **Files:** `components/AssistantMessage.tsx`, new `components/parts/ToolGroup.tsx`
- **Acceptance criteria:**
  - Group line: "▸ 5 tools (3 reads, 1 write, 1 exec) · 2.1s"
  - Expand to show individual tool lines
  - Individual tool lines still expandable to see output
  - Works with "e" key toggle

### Theme: Composer Improvements

#### PR-7: Add cursor movement to Composer
- **Why:** Table-stakes for any production text input -- users need to edit the middle of their prompts
- **Scope:** Add cursor position state, left/right arrow movement, home/end, word-level operations, cursor-position-aware backspace/delete
- **Files:** `components/Composer.tsx`
- **Acceptance criteria:**
  - Left/right arrow moves cursor within text
  - Ctrl+A goes to start, Ctrl+E goes to end
  - Ctrl+W deletes word before cursor
  - Backspace deletes character before cursor, Delete after
  - Visual cursor indicator renders at correct position
  - All existing features (history, @mentions, /slash, stash) still work correctly

#### PR-8: Extract Composer into hooks
- **Why:** Composer.tsx at 443 lines mixes too many concerns -- input editing, menu state, animations, and rendering
- **Scope:** Extract `useTextInput`, `useMentions`, `useSlashCommands` hooks from Composer
- **Files:** `components/Composer.tsx`, new `hooks/useTextInput.ts`, new `hooks/useMentions.ts`, new `hooks/useSlashCommands.ts`
- **Acceptance criteria:**
  - Composer.tsx under 200 lines
  - All existing tests pass
  - All features preserved: input, history, @mentions, /slash, stash, spinner, caret
  - Each hook is independently testable

#### PR-9: Multi-line composer input
- **Why:** Users need to paste code, error messages, and multi-line specifications
- **Scope:** Alt+Enter for newline insertion, multi-line rendering, adjusted Up/Down behavior at line boundaries
- **Files:** `components/Composer.tsx`, `hooks/useTextInput.ts`
- **Acceptance criteria:**
  - Alt+Enter or Ctrl+J inserts newline
  - Multi-line text renders correctly with line breaks
  - Up/Down navigates within lines; history only at first/last line
  - Enter submits entire content regardless of cursor position
  - Composer height adjusts for multi-line content

### Theme: Performance

#### PR-10: Height cache for completed messages
- **Why:** Eliminates O(n) markdown lexing per frame during streaming -- the biggest compute waste
- **Scope:** Module-scoped height cache keyed by message ID; cache on message completion; invalidate only for in-progress message
- **Files:** `components/MessageList.tsx`
- **Acceptance criteria:**
  - `estimateHeight` called once per completed message, not on every render
  - In-progress message height still updates per delta flush
  - No visual regression in scroll behavior
  - Measurable improvement in render time for 50+ message sessions

#### PR-11: React.memo on message components
- **Why:** Prevents re-rendering completed messages when new deltas arrive for the streaming message
- **Scope:** Wrap UserMessage, AssistantMessage, ToolPart in React.memo; ensure prop stability
- **Files:** `components/UserMessage.tsx`, `components/AssistantMessage.tsx`, `components/parts/ToolPart.tsx`
- **Acceptance criteria:**
  - Completed messages don't re-render when deltas arrive for in-progress message
  - React Profiler shows reduced render counts per frame
  - No visual regression

#### PR-12: Windowed message rendering
- **Why:** O(1) rendering cost regardless of conversation length
- **Scope:** Calculate visible message range from scroll offset + cached heights; render only visible + 2-message buffer; spacer boxes for correct scroll math
- **Files:** `components/MessageList.tsx`
- **Acceptance criteria:**
  - Only ~10-15 messages in the React tree at any time, regardless of total count
  - Scrolling (keyboard, mouse, jump, snap) works correctly
  - Sticky scroll still works during streaming
  - No visual jump when messages enter/leave the window
  - Tested with 100+ messages without performance degradation

#### PR-13: Store splitting
- **Why:** Isolates streaming hot path from UI state -- prevents theme changes from triggering streaming selectors and vice versa
- **Scope:** Split single store into useStreamStore, useAppStore, useUIStore; update all selector imports
- **Files:** `store.ts` (split into 3 files), all component files that import from store
- **Acceptance criteria:**
  - UI interactions (dialog open, theme change) don't trigger streaming store selectors
  - Streaming deltas don't trigger UI store selectors
  - All existing store tests pass (adapted for new store shape)
  - All features preserved

### Theme: Discoverability & Navigation

#### PR-14: Context-sensitive StatusBar hints
- **Why:** Users see relevant shortcuts for their current context instead of static reference text
- **Scope:** Dynamic hint computation based on: generating/idle, dialog open, permission pending, scrolled up
- **Files:** `components/StatusBar.tsx` (needs additional props or store access)
- **Acceptance criteria:**
  - Different hints shown for: idle, generating, dialog open, permission pending, scrolled up
  - Permission state shows y/a/n keys
  - Scrolled state shows scroll controls
  - Dialog state shows dialog-specific controls

#### PR-15: Scroll breadcrumbs
- **Why:** Positional awareness when scrolled up in long sessions
- **Scope:** Show "Message N/M · Xm ago" when scrolled up; disappears at bottom
- **Files:** `components/MessageList.tsx`
- **Acceptance criteria:**
  - Breadcrumb visible at top-right when `rowOffset > 0`
  - Shows current approximate message number and time offset from present
  - Disappears when snapped to bottom (sticky)
  - Doesn't overlap with toast notifications

### Theme: Code Quality & Reliability

#### PR-16: Fix type casts
- **Why:** `as any` casts hide bugs and make refactoring dangerous
- **Scope:** Create extended local types for Session, Message, Part; replace all `as any` casts
- **Files:** New `src/types.ts`, `screens/SessionScreen.tsx`, `components/UserMessage.tsx`, `components/AssistantMessage.tsx`, `components/MessageList.tsx`, `components/Sidebar.tsx`
- **Acceptance criteria:**
  - Zero `as any` casts in `packages/tui-ink/src/`
  - TypeScript compilation passes with no new errors
  - All features preserved

#### PR-17: Activate or remove sidebar
- **Why:** Dead code with `active={false}` confuses contributors and wastes render cycles
- **Scope:** Decision: activate with keyboard focus management OR remove entirely
- **Files:** `screens/SessionScreen.tsx`, `components/Sidebar.tsx`
- **Acceptance criteria:**
  - If activated: sidebar receives keyboard input when open, Tab switches between sidebar tabs, arrow keys navigate content
  - If removed: all sidebar code deleted, Ctrl+B shortcut removed or repurposed
  - No hardcoded `active={false}` anywhere

#### PR-18: Error boundaries
- **Why:** A single render error in any message component currently crashes the entire TUI
- **Scope:** React error boundaries around MessageList and BottomDock
- **Files:** New `components/ErrorBoundary.tsx`, `screens/SessionScreen.tsx`
- **Acceptance criteria:**
  - Render error in a message component shows error UI instead of crashing the TUI
  - Error UI displays the error message with recovery suggestion
  - Other parts of the UI (header, status bar, other messages) remain functional
  - Error is logged to console for debugging

---

## Appendix: Key File Reference

| File | Path | Lines | Critical For |
|------|------|-------|-------------|
| Store | `packages/tui-ink/src/store.ts` | 631 | State management, all actions |
| SDK Hook | `packages/tui-ink/src/hooks/useSDK.ts` | 281 | Bootstrap, SSE streaming, delta batching |
| MessageList | `packages/tui-ink/src/components/MessageList.tsx` | 268 | Scroll, height estimation, rendering |
| Composer | `packages/tui-ink/src/components/Composer.tsx` | 443 | Input, history, mentions, slash commands |
| ToolPart | `packages/tui-ink/src/components/parts/ToolPart.tsx` | 115 | Tool call display |
| AssistantMessage | `packages/tui-ink/src/components/AssistantMessage.tsx` | 104 | Message part dispatch, footer |
| SessionScreen | `packages/tui-ink/src/screens/SessionScreen.tsx` | 143 | Main layout composition |
| BottomDock | `packages/tui-ink/src/components/BottomDock.tsx` | 101 | Composer + dialog routing |
| Header | `packages/tui-ink/src/components/Header.tsx` | 36 | Top frame |
| StatusBar | `packages/tui-ink/src/components/StatusBar.tsx` | 32 | Bottom frame, hints |
| Theme | `packages/tui-ink/src/theme.ts` | 165 | Color palettes |
| App | `packages/tui-ink/src/app.tsx` | 112 | Root routing, global keys |
| ProviderDialog | `packages/tui-ink/src/components/ProviderDialog.tsx` | 547 | Auth flow |
| SDK Types | `packages/sdk/js/src/v2/gen/types.gen.ts` | ~2000 | Data model |
