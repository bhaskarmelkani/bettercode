# BetterCode UI 3.0 — Implementation Plan (Reviewed)

## How to use this file
OpenCode must execute one milestone at a time. Update TODO status markers in place while working: use `[~]` for the single task currently in progress, `[x]` when a task is complete, and `[!]` when a task is blocked. Keep the `Milestone notes` section for the active milestone current with decisions, blockers, regressions, and any deliberate deviation from this plan. Do not start the next milestone until the current one is stable enough, its acceptance criteria are met, and its validation steps have been run.

---

## Milestone 0 — Baseline and guardrails
### Objective
Establish an execution baseline, confirm the reviewed findings against the current codebase, and lock in the regression checklist before any UI changes land.

### Tasks
- [ ] validation — Map reviewed findings to concrete BetterCode files
  - Scope: Read `plans/ui-3.0/codex/final-codex-review.md` sections 4, 5, and 6 and write a short finding-to-file map in this milestone's notes before editing production code.
  - Why: The reviewed spec is the source of truth, but OpenCode should not infer where each finding belongs.
  - Files likely involved: `plans/ui-3.0/codex/final-codex-review.md`, `plans/ui-3.0/codex/implementation-review.md`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/store.ts`.
  - Implementation notes: The mapping should name the target milestone for each reviewed finding and call out any dependency, especially where a UX task depends on a refactor or test seam.
  - Acceptance criteria: Every planned change in Milestones 1–7 has a concrete target file list and no reviewed finding is left "somewhere in the TUI."
  - Validation: Re-read the mapping and confirm each item points to a real file via `rg --files packages/tui-ink/src`.

- [ ] validation — Capture the current UX baseline at small and normal terminal sizes
  - Scope: Launch BetterCode through the real entrypoint and record current behavior at `80x24` and `120x40` for: home screen, idle session, streaming session, tool-heavy assistant turn, permission prompt, question prompt, dock dialog, sidebar toggle attempt, and terminal resize.
  - Why: Later milestones need before/after comparisons for scroll, streaming, prompt handling, and resize behavior.
  - Files likely involved: `packages/opencode/bin/bettercode`, `packages/tui-ink/src/app.tsx`, `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: Put image paths or written observations in this milestone's notes. If screenshots are saved, store the paths here.
  - Acceptance criteria: Baseline notes exist for both terminal sizes and cover the required surfaces.
  - Validation: Launch with `./packages/opencode/bin/bettercode` and verify the notes mention exact terminal sizes and what was observed.

- [ ] validation — Run the current package-local safety checks and record the baseline result
  - Scope: Run the existing typecheck and core TUI tests from `packages/tui-ink`, not from repo root, and record pass/fail results before any UI edits.
  - Why: OpenCode needs to know whether later failures are regressions or pre-existing.
  - Files likely involved: `packages/tui-ink/package.json`, `packages/tui-ink/test/scroll.test.ts`, `packages/tui-ink/test/store.test.ts`, `packages/tui-ink/test/integration.test.ts`, `packages/tui-ink/test/dispatch.test.ts`, `packages/tui-ink/test/markdown.test.ts`.
  - Implementation notes: Use package-local commands only. Record flaky or pre-existing failures in this milestone's notes immediately. Run ALL test files, not just a subset: `cd packages/tui-ink && bun test test/`.
  - Acceptance criteria: Baseline results are recorded for `bun typecheck` and `bun test test/`.
  - Validation: Run `cd packages/tui-ink && bun typecheck` and `cd packages/tui-ink && bun test test/`.

- [ ] validation — Freeze the regression checklist OpenCode will reuse after every milestone
  - Scope: Write a repeatable checklist in this milestone's notes covering: streaming sessions, large message history (20+ messages), collapsed/expanded tool calls, keyboard shortcuts (Ctrl+K, Ctrl+S, Ctrl+N, Esc), terminal resize during idle and streaming, sidebar toggle, dialog open/close, permission/question flows, multi-line input (once available), and session switching.
  - Why: The same regression matrix must be rerun after each milestone; it should not be reinvented each time.
  - Implementation notes: Keep the checklist concise and executable. Reuse `80x24` and `120x40` sizes throughout. Include both `bun typecheck` and `bun test test/` as the automated portion.
  - Acceptance criteria: The regression matrix is written once and is specific enough to execute without interpretation.
  - Validation: Confirm every required regression area appears in the checklist.

- [ ] validation — Stop and verify before milestone 1
  - Scope: Do not edit product code until the mapping, baseline capture, and test baseline are complete and recorded.
  - Why: This milestone exists to reduce avoidable regressions and sequencing mistakes.
  - Acceptance criteria: Only planning notes changed in this milestone; no production UI files changed yet.
  - Validation: Run `git diff --name-only` and confirm no files under `packages/tui-ink/src` are modified.

### Risks / regressions to watch
- Baseline observations may reveal code drift from the reviewed spec; record it before implementing anything.
- Running the app in different terminal sizes can expose resize bugs early; keep those notes for later milestones.

### Definition of done
- The finding-to-file map is recorded.
- Baseline screenshots or notes exist for the required scenarios.
- Package-local typecheck and ALL tests have a recorded baseline result.
- A reusable regression checklist is written in the milestone notes.

### Milestone notes

---

## Milestone 1 — Visual quick wins (zero-risk)
### Objective
Land the lowest-risk, highest-visibility improvements. Every change here is cosmetic — colors, text weights, backgrounds, collapse defaults. No structural changes. No refactors.

### Tasks
- [ ] UX change — Add background framing to header and status bar
  - Scope: Add `backgroundColor={theme.mantle}` to the outer `<Box>` in Header and StatusBar.
  - Why: This is the single fastest visible improvement. The transcript immediately looks framed.
  - Files: `packages/tui-ink/src/components/Header.tsx` (line 19, the outer `<Box height={1}>`), `packages/tui-ink/src/components/StatusBar.tsx` (line 20, the outer `<Box height={1}>`).
  - Implementation notes: Do NOT add new borders, rows, or structural elements. Only add the `backgroundColor` prop.
  - Acceptance criteria: Header and status bar have a visible mantle-colored background. Layout height unchanged.
  - Validation: Manual check at `80x24` and `120x40` with default theme and one alternate theme. Run `bun typecheck`.

- [ ] UX change — Apply dim treatment to tool call text
  - Scope: Change tool row title text to use `color={theme.subtext}` while keeping only the status icon in its status color.
  - Why: Tool rows currently have the same visual weight as assistant text.
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` (around line 105, the `<Text>` rendering the tool title).
  - Implementation notes: Only change the color prop on the title text. Do not restructure the component.
  - Acceptance criteria: Tool rows are visually dimmer than assistant prose. Status icons retain their color.
  - Validation: Manual check with a tool-heavy session.

- [ ] UX change — Reduce tool kind icons from 6 to 4
  - Scope: Simplify `kind()` at `ToolPart.tsx:57-65` to 4 icons: `◇` (read/search/glob/grep), `✎` (write/edit), `$` (bash/execute), `⬡` (mcp/other).
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` lines 57-65.
  - Acceptance criteria: Only 4 kind icons exist. No visual regression in tool rows.
  - Validation: `bun typecheck`.

- [ ] UX change — Prefer `state.title` for tool summaries
  - Scope: At `ToolPart.tsx:75`, make `state.title` the primary display text when available. Fall back to `span()` only when title is absent.
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` line 75.
  - Implementation notes: The current code already checks `state.title` but only for completed tools. Make it the primary for all states.
  - Acceptance criteria: Tool rows show human-readable titles when the server provides them.
  - Validation: Manual check with a streaming session.

- [ ] UX change — Invert tool collapse default
  - Scope: Change `ToolPart.tsx:73` from `state.status !== "completed" || collapsed === false` to `collapsed === false`. This makes all tools start collapsed. Running tools show title-only (no JSON body).
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` line 73.
  - Implementation notes: Error tools should still expand automatically. Add `|| state.status === "error"` to the condition.
  - Acceptance criteria: Completed tools are collapsed. Running tools show one-line status only (no JSON input). Errors are always expanded. User can still toggle with "e" key.
  - Validation: Manual streaming session with tool calls. Verify collapse toggling still works.

- [ ] UX change — Replace round borders on tool output
  - Scope: Change `borderStyle="round"` at `ToolPart.tsx:85,91` to `borderLeft={true} borderColor={theme.surface0}` for consistency with the rest of the message border pattern.
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` lines 85, 91.
  - Acceptance criteria: Expanded tool output uses left border, not round border.
  - Validation: Manual check of expanded tool output.

- [ ] validation — Stop and verify milestone 1
  - Scope: Run `cd packages/tui-ink && bun typecheck && bun test test/` plus the manual regression checklist from Milestone 0.
  - Acceptance criteria: All tool call changes work correctly. Shell looks framed. No regressions.
  - Validation: Typecheck passes. Tests pass. Manual smoke at both terminal sizes.

### Risks / regressions to watch
- Header/status background can reduce contrast in non-default themes; verify at least 2 themes.
- Tool collapse inversion can hide useful context if error detection isn't right; verify error tools still expand.

### Definition of done
- Header and status bar frame the app with background color.
- Tool rows are visually subordinate to assistant text.
- Tool icons simplified. Tool summaries prefer `state.title`.
- Completed tools collapsed by default. Errors expanded.
- Round borders replaced with left borders.

### Milestone notes

---

## Milestone 2 — Message hierarchy and transcript polish
### Objective
Make the transcript scannable through a clear 3-weight visual hierarchy and cleaner message chrome.

### Tasks
- [ ] UX change — Apply three-weight transcript hierarchy
  - Scope: Make user messages the strongest weight (bold text, cyan border), assistant prose the neutral weight (normal text, surface2 border), and tool/metadata the lowest weight (subtext color, dim).
  - Why: The current transcript is too flat — `UserMessage` and `AssistantMessage` both use `borderLeft` with only a subtle color difference.
  - Files: `packages/tui-ink/src/components/UserMessage.tsx` (line 29 — add bold to text, keep cyan border), `packages/tui-ink/src/components/AssistantMessage.tsx` (line 55 — keep surface2 border, ensure normal weight), `packages/tui-ink/src/components/parts/ToolPart.tsx` (already dimmed in M1).
  - Implementation notes: Use existing theme tokens. Do not add new containers or borders. The hierarchy should come from text weight and color only.
  - Acceptance criteria: User messages are instantly findable by scanning. Tool rows visually recede. Clear 3-tier rhythm in a mixed session.
  - Validation: Manual scan of a long transcript (20+ messages) at `120x40`.

- [ ] UX change — Reduce message chrome and flatten nesting
  - Scope: Simplify UserMessage Box nesting from 3 levels to 1-2. Reduce padding overhead. Make metadata footers use `color={theme.overlay}` consistently.
  - Why: UserMessage currently has 4+ rows of overhead for 1-line input. Three levels of Box nesting.
  - Files: `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx` (footer section around lines 85-100).
  - Implementation notes: Target: `<Box marginTop={1} borderLeft borderColor={cyan}><Text bold>• {text}</Text></Box>` — 2 rows for single-line input. Do NOT break file badges or QUEUED indicator.
  - Acceptance criteria: Single-line user messages take fewer rows. Metadata footers are visually tertiary.
  - Validation: Compare row counts before/after at `80x24`. Run `bun typecheck`.

- [ ] UX change — Deduplicate generation indicators
  - Scope: Make the header the primary generation indicator. Remove the competing composer spinner. Composer shows dim text "Generating..." only.
  - Why: Currently `Header.tsx:27` and `Composer.tsx:374` both show spinners during generation.
  - Files: `packages/tui-ink/src/components/Header.tsx`, `packages/tui-ink/src/components/Composer.tsx` (around line 374), `packages/tui-ink/src/components/StatusBar.tsx`.
  - Implementation notes: The composer may still show dim explanatory text ("Generating... ↑↓ scroll · ctrl+c abort") but should not have its own animated spinner.
  - Acceptance criteria: One primary animated generation indicator (header). Composer is dim text only during generation.
  - Validation: Start a streaming session and verify.

- [ ] UX change — Make status-bar hints context-sensitive
  - Scope: Replace the two hardcoded hint strings at `StatusBar.tsx:16` with hints that adapt to: idle, generating, scrolled-up, dialog-open, permission-pending, question-pending.
  - Why: Footer currently shows the same hints regardless of context.
  - Files: `packages/tui-ink/src/components/StatusBar.tsx` (line 16), needs to read additional state from store or props.
  - Implementation notes: Prefer reading existing store state (e.g., check if `dialogs.length > 0`, `permissions` not empty, `rowOffset > 0`). Do NOT introduce new global flags. Keep hints to 3-5 key actions per state.
  - Acceptance criteria: Hints change when dialog opens, when permission is pending, when scrolled up, when generating.
  - Validation: Manual regression through each state transition.

- [ ] validation — Stop and verify milestone 2
  - Scope: Run automated checks and full manual regression checklist.
  - Acceptance criteria: Transcript hierarchy is visibly improved. Generation indicator is singular. Hints are contextual. No regressions.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Manual smoke at both terminal sizes.

### Risks / regressions to watch
- Visual hierarchy tweaks can make assistant text too dim or make message boundaries ambiguous; compare directly with Milestone 0 baseline.
- Status hint logic can drift from actual shortcuts if not tied to real state; keep hints narrow and accurate.
- Flattening UserMessage nesting can break file badges or the QUEUED indicator; check those specifically.

### Definition of done
- Transcript scanning clearly distinguishes user input, assistant prose, and tool/metadata.
- Message chrome is leaner without losing structural clarity.
- One generation indicator. Context-sensitive hints.

### Milestone notes

---

## Milestone 3 — Composer cursor and editing
### Objective
Make prompt entry cursor-aware with readline-style keybindings. This is the highest-risk, highest-value UX change.

### Tasks
- [ ] refactor — Extract text-input hook with behavior parity
  - Scope: Extract the raw text-editing state from `Composer.tsx` into `packages/tui-ink/src/hooks/useTextInput.ts` without changing visible behavior.
  - Why: The composer is 443 lines and cursor changes are too risky inline.
  - Files: `packages/tui-ink/src/components/Composer.tsx`, new `packages/tui-ink/src/hooks/useTextInput.ts`.
  - Implementation notes: Extract ONLY: `value` state, `setValue`, the backspace handler (line 317), and the character append (line 339). Keep mention/slash/stash/history logic in Composer for now. The hook should return `{ value, setValue, handleInput, handleKey }` with identical behavior to current Composer.
  - Acceptance criteria: Composer behaves identically to baseline. The `value` state and basic input handling now live in the hook.
  - Validation: Manual parity test — type text, backspace, submit. Run `bun typecheck`.

- [ ] UX change — Add cursor position state and left/right movement
  - Scope: Add a `cursor` number state to `useTextInput`. Implement left/right arrow movement. Make character insertion happen at cursor position instead of appending to end. Make backspace delete at cursor position.
  - Why: Currently `Composer.tsx:339` does `value + input` (append-only) and line 317 does `value.slice(0, -1)` (delete from end only).
  - Files: `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/components/Composer.tsx` (caret rendering).
  - Implementation notes: The insert operation becomes `value.slice(0, cursor) + input + value.slice(cursor)` followed by `cursor++`. Backspace becomes `value.slice(0, cursor - 1) + value.slice(cursor)` followed by `cursor--`. Caret rendering must show the cursor at the correct position, not always at the end.
  - Acceptance criteria: User can type in the middle of text. Left/right arrows move cursor. Caret renders at cursor position.
  - Validation: Manual test — type "hello", press left 3 times, type "XY", result should be "heXYllo". Backspace in middle works.

- [ ] UX change — Add readline-style controls
  - Scope: Implement `Ctrl+A` (home), `Ctrl+E` (end), `Ctrl+W` (delete word backward), `Delete` key (delete forward at cursor).
  - Files: `packages/tui-ink/src/hooks/useTextInput.ts`.
  - Implementation notes: `Ctrl+W` should delete backwards to the previous whitespace boundary. Home sets `cursor = 0`. End sets `cursor = value.length`.
  - Acceptance criteria: All four controls work correctly.
  - Validation: Manual test for each control. `bun typecheck`.

- [ ] test — Add focused tests for useTextInput hook
  - Scope: Create `packages/tui-ink/test/text-input.test.ts` with tests for: insert at cursor, delete at cursor, left/right, home/end, Ctrl+W, and edge cases (cursor at start, cursor at end, empty input).
  - Files: new `packages/tui-ink/test/text-input.test.ts`.
  - Acceptance criteria: All editing operations have test coverage.
  - Validation: `cd packages/tui-ink && bun test test/text-input.test.ts`.

- [ ] validation — Stop and verify milestone 3
  - Scope: Run automated checks plus manual composer tests. Verify arrow keys don't steal from message list scrolling. Verify mention/@, slash commands, history (up/down), stash (Ctrl+X/Y), and submit (Enter) still work correctly.
  - Why: This is the riskiest user-facing milestone.
  - Acceptance criteria: Cursor editing works. All existing composer features still work. No arrow key conflicts.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Full manual composer checklist.

### Risks / regressions to watch
- Arrow keys can conflict with message list scroll or history navigation; verify focus ownership carefully.
- Server-appended text (`composerAppend` in store) must still work — it should append at the end and move cursor to end.
- Mention query tracking after backspace (lines 321-329) must still work with cursor-aware deletion.

### Definition of done
- Cursor moves left/right. Insertion and deletion happen at cursor.
- Readline controls (home/end/delete-word) work.
- Hook has test coverage.
- All existing composer features still work.

### Milestone notes

---

## Milestone 4 — Multi-line input and composer polish
### Objective
Add multi-line editing and clean up composer/dock visual presentation.

### Tasks
- [ ] UX change — Add multi-line input support
  - Scope: `Alt+Enter` or `Ctrl+J` inserts a newline character. Plain `Enter` submits. Caret renders correctly across lines. History navigation (Up/Down) only triggers when cursor is at first/last line of multi-line content (or when content is single-line).
  - Why: Coding tool users need to paste errors, code snippets, and multi-line specs.
  - Files: `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`.
  - Implementation notes: The dock height may need to grow when multi-line input is active. Keep it simple — add rows as needed, cap at a reasonable max (e.g., 5 lines visible, scroll within input for longer). Up/Down in middle lines move the cursor between lines, NOT trigger history.
  - Acceptance criteria: Multi-line prompts can be entered, edited, and submitted. Enter still submits. No accidental sends from Alt+Enter.
  - Validation: Manual paste of multi-line content. History navigation at single-line and multi-line states.

- [ ] UX change — Simplify composer metadata and dock states
  - Scope: Make stash and attachment indicators compact. Keep slash/mention overlays readable. Ensure input row is the visual focus.
  - Why: Composer metadata currently competes with the cursor.
  - Files: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/SlashMenu.tsx`.
  - Implementation notes: Keep metadata in one compact line. Do not redesign slash or mention behavior beyond clutter reduction.
  - Acceptance criteria: Attachments, stash, and overlays are visible but secondary to the input line.
  - Validation: Manual checks for plain typing, slash filtering, mentions, attachments, generation state.

- [ ] UX change — Make permission/question focus transitions explicit
  - Scope: When a permission or question prompt appears, it is clearly the active surface. Dock height changes are clamped and predictable. StatusBar hints update to show permission-specific keys (y/a/n).
  - Why: Permissions and questions currently compete with the composer for focus.
  - Files: `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/PermissionPrompt.tsx`, `packages/tui-ink/src/components/QuestionPrompt.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`.
  - Implementation notes: Clarify focus and dock behavior, not redesign the prompt model. If dock height must change, make the transition predictable (e.g., always reserve space for permissions).
  - Acceptance criteria: Permission/question prompts are unmistakably the active surface. Dock doesn't jitter.
  - Validation: Manual checks for permission request, multi-question, rejection, resize while prompt active.

- [ ] validation — Stop and verify milestone 4
  - Scope: Run automated checks. Run full composer/dock manual matrix.
  - Acceptance criteria: Multi-line works. Dock is stable. Permissions are clear.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Full manual regression checklist.

### Risks / regressions to watch
- Multi-line input can break dock height assumptions; stop immediately if dock becomes unstable.
- History navigation in multi-line mode is tricky — Up at first line should trigger history, Up in middle line should move cursor up.

### Definition of done
- Multi-line prompts work without breaking Enter submission.
- Composer metadata is compact and secondary.
- Permission/question prompts clearly take focus.

### Milestone notes

---

## Milestone 5 — Structural cleanup
### Objective
Reduce code complexity and type safety issues. No user-visible behavior changes.

### Tasks
- [ ] refactor — Add extended types and remove `as any` casts
  - Scope: Create `packages/tui-ink/src/types.ts` with extended types. Replace all `as any` in core session surfaces.
  - Why: There are 10+ `as any` casts hiding real data-shape assumptions.
  - Files: New `packages/tui-ink/src/types.ts`, `packages/tui-ink/src/screens/SessionScreen.tsx` (lines 46, 56), `packages/tui-ink/src/components/MessageList.tsx` (lines 68, 132), `packages/tui-ink/src/components/UserMessage.tsx` (line 15), `packages/tui-ink/src/components/AssistantMessage.tsx` (lines 68, 72, 73), `packages/tui-ink/src/components/Sidebar.tsx` (line 131).
  - Implementation notes: Define `type SessionExt = Session & { parentID?: string }`, `type PartExt = Part & { synthetic?: boolean }`, etc. Do NOT touch `index.tsx:106` (`import.meta as any`) — that's a bun idiom.
  - Acceptance criteria: `rg -n "as any" packages/tui-ink/src` shows only `index.tsx:106` and any intentionally deferred cases. `bun typecheck` passes.
  - Validation: `rg -n "as any" packages/tui-ink/src` plus `bun typecheck`.

- [ ] refactor — Introduce session-scoped selector helpers
  - Scope: Replace repeated ad hoc `useAppStore` lookups with narrow, session-scoped selectors. Avoid selectors that create new arrays or objects on every update.
  - Why: SessionScreen has 14 `useAppStore()` calls. During streaming at 20Hz, all 14 evaluate on every `set()`.
  - Files: `packages/tui-ink/src/store.ts`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/MessageList.tsx`.
  - Implementation notes: Keep a single store. The goal is selector hygiene, not store splitting. Example: instead of `useAppStore(s => s.sessions).filter(...)` inside a component, create a `useChildSessions(sessionID)` selector that returns a stable reference.
  - Acceptance criteria: No component builds arrays/objects inline inside selectors. Session-scoped access patterns are explicit helpers.
  - Validation: Manual streaming test (no new jitter). `bun typecheck`. `bun test test/store.test.ts`.

- [ ] refactor — Split Composer.tsx into smaller pieces
  - Scope: Extract `useMentions` and `useSlashCommands` hooks from Composer. Main file becomes a thin composition layer.
  - Why: Composer.tsx is 443 lines mixing 5+ concerns. Milestone 3 already extracted `useTextInput`.
  - Files: `packages/tui-ink/src/components/Composer.tsx`, new `packages/tui-ink/src/hooks/useMentions.ts`, new `packages/tui-ink/src/hooks/useSlashCommands.ts`.
  - Implementation notes: Keep extraction incremental. Do NOT redesign mention/slash behavior. Verify all features still work after each extraction.
  - Acceptance criteria: Composer.tsx under 200 lines. Each hook is independently testable.
  - Validation: Re-run all Milestone 3/4 composer tests. Manual smoke: mentions, slash commands, stash, history.

- [ ] cleanup — Remove dead code and settle sidebar
  - Scope: Delete `InputBar.tsx`, `ChatPane.tsx`, `ContextPane.tsx`. Either wire sidebar `active` to real focus state or remove it.
  - Why: These files add confusion. Sidebar has `active={false}` hardcoded at `SessionScreen.tsx:137`.
  - Files: `packages/tui-ink/src/components/InputBar.tsx`, `packages/tui-ink/src/components/ChatPane.tsx`, `packages/tui-ink/src/components/ContextPane.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: Before deleting, run `rg "InputBar|ChatPane|ContextPane" packages/tui-ink/src` to confirm nothing imports them. For sidebar: prefer removing the dead code path over wiring up a feature that has no design work done.
  - Acceptance criteria: `rg -n "InputBar|ChatPane|ContextPane|active=\\{false\\}" packages/tui-ink/src` shows no stale references.
  - Validation: `bun typecheck`. Manual session check.

- [ ] validation — Stop and verify milestone 5
  - Scope: Re-run all automated checks and manual regression matrix.
  - Acceptance criteria: Codebase is simpler. Zero `as any` in core surfaces. Selectors are narrower. UI matches Milestone 4 behavior exactly.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Full manual regression checklist.

### Risks / regressions to watch
- Selector cleanup can accidentally widen subscriptions if new helpers aren't actually narrow; verify by testing during streaming.
- Deleting dead files is safe only if imports are gone; verify with `rg` first.
- Composer extraction can break subtle state interactions; re-test every feature after each extraction step.

### Definition of done
- Core session files no longer depend on `as any`.
- Session-scoped selectors are explicit and narrower.
- Composer.tsx is no longer a monolith.
- Dead code removed.

### Milestone notes

---

## Milestone 6 — Performance and stability
### Objective
Reduce transcript hot-path work, stabilize scroll behavior under streaming and resize, keep long sessions responsive.

### Tasks
- [ ] performance — Create long-session test fixture
  - Scope: Create test helpers that build 100-message and 500-message histories with mixed user text, assistant prose, tool calls (some completed, some errored), and streamed parts.
  - Why: Performance work must be measured against repeatable scenarios.
  - Files: New `packages/tui-ink/test/fixtures/transcript.ts`, `packages/tui-ink/test/scroll.test.ts`.
  - Acceptance criteria: Tests can build representative long histories without duplicating fixture code.
  - Validation: Run `bun test test/scroll.test.ts` with the new fixtures.

- [ ] performance — Add height cache for completed messages
  - Scope: Cache estimated heights so completed messages are not re-lexed on every 50ms delta flush.
  - Why: `MessageList.tsx:144-147` runs `estimateHeight` (which calls `marked.lexer` via `lex()`) on ALL messages on every delta. For 30 messages that's ~30 lex operations every 50ms.
  - Files: `packages/tui-ink/src/components/MessageList.tsx` (around lines 144-147).
  - Implementation notes: Create a module-scoped `Map<string, { height: number, version: number }>`. Key: `messageID`. Version: `parts.length + last text part length`. Only recompute when version changes. Invalidate all on width change. The `totalHeight` useMemo should read from cache for completed messages and only call `estimateHeight` for the in-progress message (identified by `pending` at line 132).
  - Acceptance criteria: `estimateHeight` is NOT called for completed messages during streaming. Total height computation is O(1) for completed messages, O(text_length) only for the active message.
  - Validation: Add test coverage for cache hit/miss. Manual scroll check — verify top and bottom are still reachable.

- [ ] performance — Stabilize `useSessionParts` references
  - Scope: Fix `useSessionParts` (lines 103-111) to not create a new `out` object on every delta when only one message's parts changed.
  - Why: Currently creates a new `Record<string, Part[]>` on every delta flush, defeating `React.memo` for all child components.
  - Files: `packages/tui-ink/src/components/MessageList.tsx` (lines 95-112).
  - Implementation notes: Compare previous and current parts references per message. Only return a new object when at least one message's parts array reference actually changed. Consider using a ref to cache the previous result.
  - Acceptance criteria: `useSessionParts` returns the same object reference when only the actively streaming message's parts changed and other messages' parts are unchanged. (In practice it will still return a new object when the streaming message updates — that's expected.)
  - Validation: `bun typecheck`. Manual streaming test — no new jitter.

- [ ] performance — Add React.memo to message components
  - Scope: Wrap `UserMessage`, `AssistantMessage`, and `ToolPart` in `React.memo`.
  - Why: These are not currently memoized. During streaming, all completed messages re-render on every delta.
  - Files: `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`.
  - Implementation notes: FIRST verify that the `.map()` in MessageList (lines 248-263) does not create inline objects as props. If it does (e.g., `parts={parts[msg.id] || []}`), fix that first — the `|| []` creates a new empty array on every render, defeating memo. Use a stable empty array constant instead.
  - Acceptance criteria: Completed message components do not re-render during streaming of an unrelated message.
  - Validation: Manual streaming observation in a 20+ message session. `bun typecheck`.

- [ ] performance — Implement windowed transcript rendering
  - Scope: Render only the visible transcript slice plus a 2-message buffer above and below. Use spacer `<Box height={N}>` elements for scroll math.
  - Why: Full-list rendering does not scale. `MessageList.tsx:248-263` iterates all messages unconditionally.
  - Files: `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/test/scroll.test.ts`.
  - Implementation notes: Preserve: sticky-bottom behavior, detached-scroll indicator, `Ctrl+Down` snap to bottom, mouse-wheel behavior, saved per-session scroll positions. If ANY of these break, stop and fix before proceeding. The existing `scroll.test.ts` has a `visibleSlice` concept that can inform the implementation.
  - Acceptance criteria: Only ~viewport+4 messages render in the React tree. Scroll behavior is functionally identical to pre-windowed UI. 500-message sessions are as responsive as 10-message sessions.
  - Validation: Updated scroll tests. Manual long-session checks. `bun typecheck`.

- [ ] performance — Remove hot-path formatting waste
  - Scope: Avoid repeated `JSON.stringify` for running tool inputs. Defer full markdown lexing during active streaming to a 200ms quiet period or message completion.
  - Why: Even after windowing, the visible streaming row still pays formatting cost on every 50ms delta.
  - Files: `packages/tui-ink/src/components/parts/ToolPart.tsx` (the `json()` call for pending input), `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`.
  - Implementation notes: For ToolPart: running tools already show title-only after Milestone 1, so JSON formatting should be minimal. For MarkdownRenderer: consider showing raw text during active streaming and lexing on a debounced timer. Keep simplified mode limited to the active message only.
  - Acceptance criteria: Streaming feels smooth. No visible formatting delay when message completes.
  - Validation: Manual streaming with long assistant output and several tool calls.

- [ ] validation — Stress-test long sessions before milestone 7
  - Scope: Run full regression matrix with extra focus on: 100+ message sessions, terminal resize mid-stream, collapsed/expanded tools, session switching with different scroll positions.
  - Acceptance criteria: Long sessions are stable and responsive. No scroll or streaming regressions.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Full manual regression checklist with emphasis on long sessions.

### Risks / regressions to watch
- Windowed rendering can easily break sticky scrolling, saved positions, and scroll-to-bottom; treat those as blockers.
- Reference stabilization must happen BEFORE React.memo — memo without stable refs is useless.
- Debounced markdown lexing can cause a visible flash when the formatted version appears; keep the delay short and local.

### Definition of done
- Height estimation cached for completed messages.
- Part references stable for unchanged messages.
- Message components memoized.
- Only visible messages render.
- Hot-path formatting deferred.
- Long sessions pass the regression matrix.

### Milestone notes

---

## Milestone 7 — Production hardening and polish
### Objective
Close edge-state, resize, keyboard-consistency, and polish gaps.

### Tasks
- [ ] validation — Audit remaining edge-state gaps
  - Scope: List remaining gaps for loading/empty/error states, abort flows, reconnect behavior, prompt rejection, narrow terminals, theme picker behavior, and dialog/help consistency.
  - Implementation notes: Record the audit in this milestone's notes first, then patch the highest-signal gaps only.
  - Acceptance criteria: Concrete, finite list of remaining items in notes.

- [ ] UX change — Harden empty, loading, error, and interrupt states
  - Scope: Make home screen, assistant error display, prompt callouts, and overlay states consistent. Include clear recovery guidance. Don't rely on color alone.
  - Files: `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/DialogOverlay.tsx`, `packages/tui-ink/src/components/PermissionPrompt.tsx`, `packages/tui-ink/src/components/QuestionPrompt.tsx`, `packages/tui-ink/src/components/ToastOverlay.tsx`.
  - Acceptance criteria: Error/loading/interrupted states are readable, compact, and tell the user what to do next.
  - Validation: Manual checks for home loading, failed sync, assistant error, aborted run, permission/question reject.

- [ ] UX change — Keyboard consistency pass
  - Scope: Align close/confirm/cancel hints across all dialogs. Ensure help surface reflects actual keybindings. Resolve stale shortcut copy.
  - Files: `packages/tui-ink/src/app.tsx`, `packages/tui-ink/src/components/HelpDialog.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/components/CommandPalette.tsx`, `packages/tui-ink/src/components/SessionListDialog.tsx`, all picker dialogs.
  - Implementation notes: Note any terminal conflicts (Ctrl+K = kill line, Ctrl+S = XON/XOFF) in milestone notes rather than hiding them.
  - Acceptance criteria: Help text, footer hints, and dialog footers all agree on shortcuts and close/confirm behavior.
  - Validation: Manual dialog sweep using keyboard only.

- [ ] UX change — Harden resize and narrow-width behavior
  - Scope: Verify and fix resize for session shell, home screen, dock, dialogs at `80x24`, `100x30`, `120x40`.
  - Files: `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`.
  - Implementation notes: Add sidebar width guard: auto-hide below 120 columns. Keep behavior simple — clamp widths, hide optional surfaces, preserve primary interaction.
  - Acceptance criteria: App remains readable and navigable at all target sizes. No overlapping or truncated critical surfaces.
  - Validation: Manual resize checks while idle, streaming, and with dock dialog open.

- [ ] cleanup — Fix theme preview and border consistency
  - Scope: Keep theme preview local until confirm (`ThemePickerDialog.tsx:32`). Verify border grammar is consistent: `borderLeft` for hierarchy, `─` separators, no `borderStyle="round"` anywhere.
  - Files: `packages/tui-ink/src/components/ThemePickerDialog.tsx`, verify across all components.
  - Acceptance criteria: Theme browsing doesn't cause global rerenders. Consistent border grammar throughout.
  - Validation: Manual theme picker check. `rg "borderStyle" packages/tui-ink/src` should show no "round".

- [ ] cleanup — Add React error boundaries
  - Scope: Wrap MessageList and BottomDock in error boundaries that show a fallback message instead of crashing the TUI.
  - Why: Currently a single render error in any message component crashes the entire app.
  - Files: `packages/tui-ink/src/screens/SessionScreen.tsx` (or a new `ErrorBoundary.tsx` component).
  - Acceptance criteria: A render error in one message shows a fallback, not a crash.
  - Validation: Temporarily introduce a throw in a message component, verify fallback renders, then remove the throw.

- [ ] validation — Final release-candidate sweep
  - Scope: Run full automated and manual checklist. Record final outcome.
  - Acceptance criteria: Full regression matrix passes or every remaining failure is explicitly documented as deferred.
  - Validation: `cd packages/tui-ink && bun typecheck && bun test test/`. Complete manual matrix from Milestone 0.

### Risks / regressions to watch
- Final polish can accidentally reopen behavior that earlier milestones stabilized; treat any reopened regression as a stop issue.
- Help/shortcut copy can drift from actual behavior unless updated in the same task.

### Definition of done
- Edge states are compact, readable, and actionable.
- Keyboard help and dialog footers match actual shortcuts.
- UI is usable at all target terminal sizes.
- Error boundaries prevent TUI crashes.
- Theme preview is local until confirm.
- Final regression sweep is recorded.

### Milestone notes

---

## Open questions / deferred items
- **Transcript search and jump navigation** — deferred until core transcript and composer work is stable.
- **Tool summary grouping** (5+ consecutive tools into one summary line) — deferred unless Milestone 1 tool changes still leave tool-heavy turns too noisy.
- **Store splitting** into `useStreamStore`, `useAppStore`, `useUIStore` — deferred unless Milestone 6 measurements show selector narrowing is insufficient.
- **Shared dialog primitives** — deferred; do not start unless a milestone explicitly calls for it.
- **Dedicated diff/log viewer** for tool output — deferred; current scope only needs cleaner inline summaries.
- **HomeScreen compact mode** — deferred to Milestone 7 if resize audit reveals it's needed.

## Execution rules for OpenCode
1. Implement one milestone at a time. Do not start the next until the current one is stable and fully revalidated.
2. Update TODO statuses continuously in this file. At most one `[~]` task in the active milestone.
3. Keep each milestone's notes current with decisions, blockers, regressions, and deviations.
4. Prefer small, reviewable commits over large rewrites.
5. Do not invent architecture beyond what is written here. If a structural choice is needed that isn't specified, stop, note the decision point, and take the smallest safe option.
6. Complete and verify dependencies before starting dependent tasks.
7. Keep UX changes and refactors separate whenever possible. Do not hide behavior changes inside cleanup tasks.
8. Use package-local commands: `cd packages/tui-ink && bun typecheck` and `cd packages/tui-ink && bun test test/`.
9. After each milestone, run the milestone acceptance checks AND the reusable regression checklist.
10. If a regression appears in streaming, scrolling, tool collapse, keyboard handling, terminal resize, or long-session stability: **stop and fix before continuing**.
11. When editing `ToolPart.tsx`, always verify: collapse toggling ("e" key), error auto-expansion, and tool lifecycle (pending → running → completed).
12. When editing `Composer.tsx` or `useTextInput.ts`, always verify: Enter submits, backspace works, history (up/down) works, stash (Ctrl+X/Y) works, mentions (@) work, slash commands (/) work.
