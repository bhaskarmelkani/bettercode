# BetterCode UI 3.0 — Final Implementation Plan

Primary source of truth:

- `plans/ui-3.0/codex/final-codex-review.md`

Important supporting files:

- `plans/ui-3.0/codex/implementation-review.md`
- `plans/ui-3.0/codex/final.md`
- `plans/ui-3.0/codex/claude-review.md`
- `plans/better-tui/PLAN.md`
- `AGENTS.md`
- `.opencode/skills/bettercode-ui-implementation/SKILL.md`

## How to use this file

- Execute one milestone at a time.
- Keep this file updated while implementing.
- Use `[ ]` for not started, `[~]` for in progress, `[x]` for done, `[!]` for blocked.
- Keep at most one `[~]` task in the active milestone.
- Do not start the next milestone until the current one is stable and fully verified.
- If a task changes scope, note the deviation in the milestone notes before moving on.
- If a regression appears in streaming, scrolling, tool collapse, keyboard handling, terminal resize, session switching, or permission/question flows, stop and fix it before continuing.

## Rules for OpenCode

- Work from `plans/ui-3.0/implementation.md`, not from memory.
- Treat every milestone as a separate reviewable chunk.
- Prefer small commits and small diffs.
- Do not combine cosmetic work, behavior changes, and refactors in the same task unless the plan explicitly says so.
- Do not invent new architecture unless the plan explicitly calls for it.
- Update the milestone notes with decisions, blockers, and follow-ups.
- Run validation from `packages/tui-ink`, never from repo root.
- Use `dev` or `origin/dev` for diffs if a base branch is needed.

## Validation commands

Run these from `packages/tui-ink` unless a task says otherwise.

- `bun typecheck`
- `bun test test/`
- `bun test test/<file>.test.ts` for focused checks during a milestone
- `../../packages/opencode/bin/bettercode` or `./packages/opencode/bin/bettercode` from repo root for manual UI checks

## Manual regression checklist

Re-run this checklist after every milestone.

- [ ] Launch BetterCode at `80x24`
- [ ] Launch BetterCode at `120x40`
- [ ] Open home screen and verify empty/loading/ready states
- [ ] Open an existing session and verify transcript rendering
- [ ] Start a streaming session and verify sticky-bottom behavior
- [ ] Scroll up during streaming and verify detached-scroll behavior
- [ ] Snap back to bottom and verify stream catches up cleanly
- [ ] Inspect a tool-heavy turn with collapsed and expanded tool calls
- [ ] Open and close a dock dialog
- [ ] Toggle the sidebar if it is still enabled at this milestone
- [ ] Trigger a permission prompt and answer it from keyboard
- [ ] Trigger a question prompt and answer or reject it from keyboard
- [ ] Switch sessions and verify per-session scroll position and message loading
- [ ] Resize the terminal while idle
- [ ] Resize the terminal while streaming
- [ ] Verify no obvious flicker, terminal jitter, or lost focus state

## Milestone 0 — Baseline and guardrails

Goal: lock down the working set, baseline behavior, and regression process before touching the UI.

Checklist:

- [ ] validation — Map the reviewed findings to concrete files
  - Read `plans/ui-3.0/codex/final-codex-review.md` sections 4, 5, 6, and 7.
  - Add a short finding-to-file map in this milestone's notes.
  - Call out which findings belong to which later milestone.
  - Files to map explicitly:
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/Header.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
    - `packages/tui-ink/src/store.ts`

- [ ] validation — Capture the current baseline at `80x24` and `120x40`
  - Record what the following look like before changes:
    - Home screen
    - Idle session
    - Streaming session
    - Tool-heavy assistant turn
    - Permission prompt
    - Question prompt
    - Dock dialog
    - Sidebar toggle attempt
    - Resize while idle
    - Resize while streaming
  - Put screenshot paths or written notes in this milestone's notes.

- [ ] validation — Run the package-local automated baseline
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Record any pre-existing failures in the milestone notes.

- [ ] validation — Confirm key hot-path files and dead-code surfaces
  - Verify the current hot-path files still match the review:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/store.ts`
  - Verify the currently dead or ambiguous surfaces still exist:
    - `packages/tui-ink/src/components/InputBar.tsx`
    - `packages/tui-ink/src/components/ChatPane.tsx`
    - `packages/tui-ink/src/components/ContextPane.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`

- [ ] validation — Stop and verify milestone 0
  - Confirm no production files under `packages/tui-ink/src` were changed during this milestone.
  - Confirm the manual regression checklist above is complete enough to reuse.

Done when:

- [ ] Finding-to-file map exists in the milestone notes
- [ ] Baseline behavior notes exist for both terminal sizes
- [ ] `bun typecheck` and `bun test test/` baseline results are recorded
- [ ] The reusable regression checklist is ready for every later milestone

Milestone notes:

## Milestone 1 — Shell framing and status cleanup

Goal: land the safest shell-level improvements first with no major structural changes.

Checklist:

- [ ] UX change — Add background framing to header and status bar
  - Files:
    - `packages/tui-ink/src/components/Header.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
  - Change only the outer container styling.
  - Use `backgroundColor={theme.mantle}`.
  - Do not add extra rows, borders, or new components.

- [ ] UX change — Make the header the primary generation indicator
  - Files:
    - `packages/tui-ink/src/components/Header.tsx`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Keep a single animated generation indicator in the header.
  - The composer may show dim text for generating state, but no competing spinner.
  - Keep status wording consistent: `ready`, `generating`, `error`.

- [ ] UX change — Make status-bar hints context-sensitive
  - Files:
    - `packages/tui-ink/src/components/StatusBar.tsx`
    - `packages/tui-ink/src/store.ts`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
  - Support distinct hint states for:
    - idle
    - generating
    - scrolled up
    - dialog open
    - permission pending
    - question pending
  - Use existing state when possible. Do not add broad new global flags just for copy.

- [ ] UX change — Guard the sidebar on narrow terminals
  - Files:
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`
  - Prevent the fixed-width sidebar from taking over `80x24`.
  - Keep this milestone simple:
    - hide or refuse to open it below a defined width threshold
    - keep the main transcript usable
  - Do not redesign the sidebar yet.

- [ ] validation — Stop and verify milestone 1
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Run the full manual regression checklist.
  - Note any theme-specific contrast issues in the milestone notes.

Done when:

- [ ] Header and status bar visually frame the app
- [ ] The header is the only primary generation indicator
- [ ] Footer hints change with UI state
- [ ] Narrow terminals stay usable without sidebar crowding

Milestone notes:

## Milestone 2 — Tool-call defaults and execution detail cleanup

Goal: make tool activity quieter and more readable before changing the broader transcript styling.

Checklist:

- [ ] refactor — Extract tool summary helpers before changing behavior
  - Files:
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - optional new helper file near `ToolPart.tsx`
  - Pull out logic for:
    - tool kind classification
    - title selection
    - duration formatting
    - default open/closed decision
  - Keep the helper narrowly scoped to tool rows.

- [ ] UX change — Reduce tool kind icons from 6 to 4
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Use only:
    - `◇` for read/search/glob/grep
    - `✎` for write/edit
    - `$` for bash/execute
    - `⬡` for mcp and remaining external tool kinds

- [ ] UX change — Prefer `state.title` as the primary summary
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Use `state.title` whenever it exists.
  - Fall back to a concise input-derived summary only when title is missing.
  - Do not show noisy raw keys like `file_read` unless no better summary exists.

- [ ] UX change — Invert tool disclosure defaults
  - Files:
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/store.ts`
  - Make successful tools collapsed by default.
  - Make running tools render as one-line progress rows by default.
  - Make error tools expand automatically.
  - Preserve manual collapse/expand behavior.

- [ ] UX change — Remove raw JSON input from default running state
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Running tools should not render raw input JSON unless the row is explicitly expanded or the tool errors.
  - Replace it with a concise title/status line.

- [ ] UX change — Replace round borders with transcript-consistent left rails
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Replace `borderStyle="round"` usage with the same left-rail grammar used elsewhere.
  - Keep error presentation clearly stronger than success presentation.

- [ ] test — Add or update tool collapse behavior coverage
  - Files:
    - `packages/tui-ink/test/store.test.ts`
    - `packages/tui-ink/test/integration.test.ts`
  - Cover:
    - default collapsed success tools
    - expanded errors
    - expand/collapse toggling
    - running-to-completed transition

- [ ] validation — Stop and verify milestone 2
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - tool-heavy streaming turn
    - successful tool rows
    - failed tool rows
    - expand/collapse interaction

Done when:

- [ ] Successful tool rows are collapsed by default
- [ ] Running tools are concise one-line rows
- [ ] Errors expand automatically
- [ ] Tool rows no longer default to raw JSON noise
- [ ] Tool behavior is covered by tests

Milestone notes:

## Milestone 3 — Transcript hierarchy and message chrome

Goal: make the conversation scannable by separating user input, assistant prose, and execution detail.

Checklist:

- [ ] UX change — Apply the 3-weight hierarchy across the transcript
  - Files:
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Make user messages the strongest weight.
  - Keep assistant prose neutral/default.
  - Keep tool rows and metadata visibly tertiary.
  - Use existing theme tokens. Do not add heavy new containers.

- [ ] UX change — Flatten user message nesting and reduce row overhead
  - File: `packages/tui-ink/src/components/UserMessage.tsx`
  - Reduce excess nested `Box` wrappers.
  - Preserve:
    - markdown rendering
    - file badges
    - `QUEUED` indicator
  - Optimize for fewer rows for short user messages.

- [ ] UX change — Make assistant footers and metadata consistently tertiary
  - File: `packages/tui-ink/src/components/AssistantMessage.tsx`
  - Ensure duration, tokens, model/mode, and interrupted/error-adjacent footer copy read as metadata, not body content.
  - Use one consistent visual weight for footer text.

- [ ] UX change — Keep tool rows structurally subordinate to assistant prose
  - Files:
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Keep tool rows visibly nested under the assistant turn.
  - Avoid making tool rows look like peer messages.

- [ ] validation — Stop and verify milestone 3
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify a 20+ message transcript at `120x40` and `80x24`.
  - Compare against Milestone 0 notes for scanability.

Done when:

- [ ] User input is easy to locate at a glance
- [ ] Assistant prose is the visual center of the transcript
- [ ] Tool rows and metadata recede without becoming unreadable
- [ ] Short user messages occupy less vertical space than baseline

Milestone notes:

## Milestone 4 — Composer extraction and parity

Goal: separate text-editing logic from `Composer.tsx` before changing composer behavior.

Checklist:

- [ ] refactor — Extract a focused `useTextInput` hook with behavior parity
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - new `packages/tui-ink/src/hooks/useTextInput.ts`
  - Move only the plain text editing state first:
    - `value`
    - basic insertion
    - basic deletion
    - submit helper hooks if needed
  - Keep mention, slash, stash, and history logic in `Composer.tsx` for now.
  - Do not change visible behavior in this task.

- [ ] test — Add a focused hook test file
  - File: new `packages/tui-ink/test/text-input.test.ts`
  - Start with parity tests for the extracted behavior:
    - append characters
    - delete with backspace
    - submit path if the hook owns it

- [ ] refactor — Rewire `Composer.tsx` to use the hook without behavior changes
  - File: `packages/tui-ink/src/components/Composer.tsx`
  - Keep current mention/slash/history behavior intact.
  - Keep current submit behavior intact.
  - Keep current placeholder and stash/attachment rendering intact.

- [ ] validation — Stop and verify milestone 4
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - plain typing
    - backspace
    - slash menu
    - mention menu
    - history up/down
    - stash restore

Done when:

- [ ] `Composer.tsx` no longer owns the raw text state inline
- [ ] Extracted hook has parity coverage
- [ ] Composer behavior matches pre-refactor behavior

Milestone notes:

## Milestone 5 — Cursor-aware composer editing

Goal: make the composer editor-grade for single-line editing before adding multi-line input.

Checklist:

- [ ] UX change — Add explicit cursor state
  - Files:
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Add `cursor` tracking.
  - Render the caret at the actual cursor position, not only at the end.

- [ ] UX change — Insert text at the cursor instead of appending to the end
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Replace append-only insertion with cursor-aware insertion.
  - Cursor should advance after insertion.

- [ ] UX change — Delete backward and forward at the cursor
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Backspace should delete before the cursor.
  - Delete should delete after the cursor.
  - Keep safe behavior at start/end boundaries.

- [ ] UX change — Add left/right cursor movement
  - Files:
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Left/right arrows should move the cursor within the text.
  - Verify these keys still route elsewhere when the composer is inactive.

- [ ] UX change — Add readline-style keybindings
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Implement:
    - `Ctrl+A` home
    - `Ctrl+E` end
    - `Ctrl+W` delete previous word
  - Keep existing `Ctrl+U`, `Ctrl+X`, and `Ctrl+Y` behavior working.

- [ ] UX change — Keep server-appended composer text deterministic
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/store.ts`
  - Decide and document how `composerAppend` behaves with a non-end cursor.
  - Default recommendation:
    - append server-provided text at the end
    - move cursor to end
  - Record the choice in milestone notes.

- [ ] test — Expand `text-input.test.ts` for cursor-aware editing
  - File: `packages/tui-ink/test/text-input.test.ts`
  - Add coverage for:
    - insert in middle
    - backspace in middle
    - delete in middle
    - left/right movement
    - home/end
    - delete previous word
    - empty input edge cases

- [ ] validation — Stop and verify milestone 5
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - edit in middle of prompt
    - delete in middle of prompt
    - home/end
    - history still works
    - slash and mention overlays still work
    - arrow keys do not break message-list behavior when composer is inactive

Done when:

- [ ] Cursor-aware editing works in the composer
- [ ] Readline-style single-line controls work
- [ ] Existing composer features still work
- [ ] The cursor-aware hook is covered by tests

Milestone notes:

## Milestone 6 — Multi-line composer and bottom-dock state handling

Goal: support multi-line prompts and make dock state transitions predictable when prompts or dialogs take focus.

Checklist:

- [ ] refactor — Define multi-line input rules before implementation
  - Files:
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
  - Record the intended rules in the milestone notes before coding:
    - newline shortcut
    - submit shortcut
    - caret movement across lines
    - history behavior at top/bottom lines
    - visible line cap

- [ ] UX change — Add explicit newline insertion
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Support `Alt+Enter` or `Ctrl+J` for inserting `\n`.
  - Keep plain `Enter` as submit.

- [ ] UX change — Render multi-line input and caret correctly
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
  - Render multi-line content in the composer.
  - Cap the visible input height to avoid the dock taking over the screen.
  - Keep the input readable on both `80x24` and `120x40`.

- [ ] UX change — Make history and arrow behavior line-aware
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Only trigger prompt history navigation when the cursor is at the top or bottom logical line.
  - Do not trigger history when the user is navigating inside multi-line content.

- [ ] UX change — Compact stash, attachment, and helper metadata
  - File: `packages/tui-ink/src/components/Composer.tsx`
  - Keep stash and attachment indicators visible but secondary to the input.
  - Do not let these indicators push the cursor out of view unnecessarily.

- [ ] UX change — Stabilize bottom-dock behavior when permissions or questions appear
  - Files:
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - `packages/tui-ink/src/components/PermissionPrompt.tsx`
    - `packages/tui-ink/src/components/QuestionPrompt.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
  - Make the active prompt surface obvious.
  - Ensure hints match the active surface.
  - Keep dock growth/clamping predictable.
  - Avoid confusing focus handoffs when a prompt arrives mid-stream.

- [ ] test — Add focused multi-line and dock-state coverage where practical
  - Files:
    - `packages/tui-ink/test/text-input.test.ts`
    - add a composer-focused test file if needed
  - Cover:
    - newline insertion
    - multi-line caret movement helpers if testable
    - history guard behavior around multi-line input

- [ ] validation — Stop and verify milestone 6
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - multi-line paste
    - newline insertion
    - submit still works
    - permission prompt focus
    - question prompt focus
    - resize while a prompt is active

Done when:

- [ ] Multi-line prompts work without breaking plain Enter submit
- [ ] Composer metadata stays secondary to the input
- [ ] Permission/question prompts feel like the active surface when shown
- [ ] Dock behavior is predictable during prompt-state changes

Milestone notes:

## Milestone 7 — Structural cleanup and ownership

Goal: reduce ambiguity in data shapes, selectors, and live component ownership before heavy performance changes.

Checklist:

- [ ] refactor — Add explicit UI-side types for sessions, messages, and parts
  - Files:
    - new `packages/tui-ink/src/types.ts`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`
  - Replace core `as any` usage around:
    - `parentID`
    - synthetic/ignored parts
    - message timing/model/mode/footer metadata

- [ ] refactor — Narrow session-scoped selectors
  - Files:
    - `packages/tui-ink/src/store.ts`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
  - Replace ad hoc object/array-building selectors with explicit narrow selectors or small selector helpers.
  - Avoid selectors that create new arrays or objects on every store update.
  - Keep this milestone to selector hygiene only. Do not split the store yet.

- [ ] refactor — Finish splitting `Composer.tsx` into owned pieces
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - optional new hooks for mentions or slash behavior
  - Only extract behavior that is already stable from Milestones 4-6.
  - The goal is smaller ownership boundaries, not a redesign.

- [ ] cleanup — Remove dead session UI surfaces
  - Files:
    - `packages/tui-ink/src/components/InputBar.tsx`
    - `packages/tui-ink/src/components/ChatPane.tsx`
    - `packages/tui-ink/src/components/ContextPane.tsx`
  - Verify there are no live imports first.
  - Remove them if truly unused.

- [ ] cleanup — Settle sidebar ownership
  - Files:
    - `packages/tui-ink/src/components/Sidebar.tsx`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
  - Remove `active={false}` hardcoding.
  - Either wire a real active path or constrain the sidebar clearly enough that its future state is unambiguous.
  - Record the decision in milestone notes.

- [ ] validation — Stop and verify milestone 7
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Run `rg -n "as any" packages/tui-ink/src` and record any intentionally deferred cases.
  - Re-run the manual regression checklist.

Done when:

- [ ] Core TUI session/transcript files no longer depend on broad `as any` casts
- [ ] Session-scoped selector ownership is clearer and narrower
- [ ] `Composer.tsx` is materially smaller and easier to reason about
- [ ] Dead session UI files are removed or intentionally retained with a documented reason

Milestone notes:

## Milestone 8 — Transcript performance prep

Goal: add measurement scaffolding and eliminate the worst unnecessary height work before windowing.

Checklist:

- [ ] performance — Add reusable long-session fixtures for transcript tests
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
    - optional new fixture file under `packages/tui-ink/test/`
  - Build reusable fixture helpers for:
    - 20-message mixed transcript
    - 100-message transcript
    - 500-message transcript
    - mixed text + tool rows

- [ ] performance — Add height-cache scaffolding for completed messages
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Cache estimated message heights by message id and width-sensitive version.
  - Only invalidate for:
    - width changes
    - in-progress messages
    - actual part changes for the message being measured

- [ ] performance — Keep the height cache isolated and testable
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - If needed, extract pure helper logic for:
    - cache key/version calculation
    - visible range calculation
  - Keep helpers small and local to transcript rendering.

- [ ] test — Add or extend height and scroll tests
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
  - Cover:
    - completed-message cache reuse assumptions
    - width change invalidation
    - correct total/visible height behavior after caching

- [ ] validation — Stop and verify milestone 8
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - long transcript still scrolls correctly
    - no empty bands appear
    - top/bottom reachability still works

Done when:

- [ ] Long-session fixtures exist for later transcript performance work
- [ ] Completed messages no longer need full height recomputation on every delta
- [ ] Scroll tests still reflect correct behavior

Milestone notes:

## Milestone 9 — Transcript performance implementation

Goal: reduce rerenders and visible work so long sessions stay responsive under streaming.

Checklist:

- [ ] performance — Stabilize `useSessionParts` references
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Avoid returning a brand-new message-to-parts object on every delta when most messages are unchanged.
  - Preserve correct updates for the active streaming message.

- [ ] performance — Add targeted memoization to transcript rows
  - Files:
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/components/parts/TextPart.tsx`
  - Only add `React.memo` after reference stability is fixed.
  - Verify props are stable enough for memoization to help.

- [ ] performance — Implement visible-window rendering
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Render only the visible transcript slice plus a small buffer.
  - Use spacer rows or equivalent layout placeholders to preserve scroll math.
  - Preserve:
    - sticky-bottom behavior
    - detached scroll indicator
    - `ctrl+down` snap to bottom
    - mouse-wheel behavior
    - saved per-session scroll positions

- [ ] performance — Reduce remaining hot-path formatting during streaming
  - Files:
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`
  - Keep running tools from doing expensive JSON formatting on every render.
  - If temporary simplified rendering is needed for the actively streaming row, keep it local to that row only.

- [ ] test — Expand scroll and integration coverage for long sessions
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
    - `packages/tui-ink/test/integration.test.ts`
  - Cover:
    - long transcript visible window behavior
    - scroll up/down after many messages
    - stream updates while detached from bottom
    - return to sticky bottom

- [ ] validation — Stop and verify milestone 9
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Re-run the full manual regression checklist with extra focus on:
    - 100+ messages
    - tool-heavy turns
    - resize mid-stream
    - session switching after long scrollback

Done when:

- [ ] Completed rows do not rerender needlessly during streaming
- [ ] Only a visible transcript window is rendered
- [ ] Scroll behavior still matches user expectations
- [ ] Long sessions are visibly more stable than baseline

Milestone notes:

## Milestone 10 — Hardening and final polish

Goal: finish the edge states, keyboard consistency, narrow-terminal behavior, and remaining low-risk polish.

Checklist:

- [ ] UX change — Harden empty, loading, error, and interrupted states
  - Files:
    - `packages/tui-ink/src/screens/HomeScreen.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/DialogOverlay.tsx`
    - `packages/tui-ink/src/components/PermissionPrompt.tsx`
    - `packages/tui-ink/src/components/QuestionPrompt.tsx`
    - `packages/tui-ink/src/components/ToastOverlay.tsx`
  - Make states compact, readable, and explicit about the next action.
  - Avoid relying on color alone.

- [ ] UX change — Run a keyboard consistency pass
  - Files:
    - `packages/tui-ink/src/app.tsx`
    - `packages/tui-ink/src/components/HelpDialog.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
    - dock dialogs under `packages/tui-ink/src/components/`
  - Make help copy, footer hints, and dialog footers match the actual shortcuts.
  - Clean up stale or conflicting wording.

- [ ] UX change — Harden resize and narrow-width behavior
  - Files:
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/screens/HomeScreen.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`
    - dock dialogs as needed
  - Verify `80x24`, `100x30`, and `120x40`.
  - Hide or compress non-essential surfaces before crowding the primary workflow.

- [ ] UX change — Put the home screen into compact mode on small terminals
  - File: `packages/tui-ink/src/screens/HomeScreen.tsx`
  - Show a simpler, action-first home state on short or narrow terminals.
  - Keep oversized branding off constrained layouts.

- [ ] cleanup — Fix theme picker preview behavior
  - File: `packages/tui-ink/src/components/ThemePickerDialog.tsx`
  - Keep theme preview local until confirmation.
  - Avoid committing global theme changes on every selection movement.

- [ ] reliability — Add error boundaries around critical live surfaces
  - Files:
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - surrounding shell files as needed
  - Keep a single renderer failure from taking down the whole TUI.

- [ ] validation — Final release-candidate sweep
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Re-run the full manual regression checklist.
  - Add final notes covering:
    - what passed
    - what was deferred
    - what still needs future work

Done when:

- [ ] Edge states are compact and coherent
- [ ] Keyboard help and live hints agree with real behavior
- [ ] Small terminals remain usable
- [ ] Theme preview no longer causes global churn
- [ ] Final automated and manual sweeps are recorded

Milestone notes:

## Deferred items

- [ ] Store splitting into multiple Zustand stores. Only do this in a future pass if Milestone 9 still leaves measurable hot-path issues.
- [ ] Transcript search and jump navigation.
- [ ] Grouped tool-summary rows for 5+ consecutive tools.
- [ ] Dedicated diff/log viewer for expanded tool output.
- [ ] Shared dialog primitives across all picker dialogs.

## Final delivery checklist

- [ ] `plans/ui-3.0/implementation.md` stays updated during implementation
- [ ] Milestone notes are kept current
- [ ] Every milestone ends with typecheck, tests, and manual regression checks
- [ ] No milestone moves forward with unresolved regressions in core transcript/composer behavior
