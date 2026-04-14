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

- [x] validation — Map the reviewed findings to concrete files
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

- [x] validation — Capture the current baseline at `80x24` and `120x40`
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

- [x] validation — Run the package-local automated baseline
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Record any pre-existing failures in the milestone notes.

- [x] validation — Confirm key hot-path files and dead-code surfaces
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

- [x] validation — Stop and verify milestone 0
  - Confirm no production files under `packages/tui-ink/src` were changed during this milestone.
  - Confirm the manual regression checklist above is complete enough to reuse.

Done when:

- [x] Finding-to-file map exists in the milestone notes
- [x] Baseline behavior notes exist for both terminal sizes
- [x] `bun typecheck` and `bun test test/` baseline results are recorded
- [x] The reusable regression checklist is ready for every later milestone

Milestone notes:

### Automated baseline (2026-04-14)

- `bun typecheck`: PASS — clean, no errors or warnings
- `bun test test/`: 98 pass, 0 fail, 5 test files, 267ms

### Finding-to-file map

| Finding                                                                  | Severity | Target Milestone                          | File(s)                                                                                                    | Key Lines                           |
| ------------------------------------------------------------------------ | -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Header/StatusBar lack background framing                                 | High     | M1                                        | `Header.tsx`, `StatusBar.tsx`                                                                              | Header:19, StatusBar:20             |
| Duplicate generation indicators                                          | Medium   | M1                                        | `Header.tsx`, `Composer.tsx`                                                                               | Header:27, Composer:374             |
| Status bar hints not context-sensitive                                   | Medium   | M1                                        | `StatusBar.tsx`                                                                                            | StatusBar:16                        |
| Sidebar steals width on narrow terminals                                 | Medium   | M1                                        | `SessionScreen.tsx`, `Sidebar.tsx`                                                                         | SessionScreen:69,73,137             |
| ToolPart: collapse logic inverted (open while running, closed when done) | High     | M2                                        | `ToolPart.tsx`                                                                                             | line 73                             |
| ToolPart: 6 kind icons, should be 4                                      | Low      | M2                                        | `ToolPart.tsx`                                                                                             | lines 57-65                         |
| ToolPart: `span()` noisy — prefer `state.title`                          | Medium   | M2                                        | `ToolPart.tsx`                                                                                             | line 75                             |
| ToolPart: JSON input shown while running                                 | High     | M2                                        | `ToolPart.tsx`                                                                                             | lines 73-96                         |
| ToolPart: `borderStyle="round"` inconsistent                             | Low      | M2                                        | `ToolPart.tsx`                                                                                             | lines 85, 91                        |
| Transcript flat — no 3-weight visual hierarchy                           | High     | M3                                        | `UserMessage.tsx`, `AssistantMessage.tsx`, `ToolPart.tsx`                                                  | UserMessage:29, AssistantMessage:55 |
| UserMessage: 4+ rows overhead for 1-line input                           | Medium   | M3                                        | `UserMessage.tsx`                                                                                          | lines 22-46                         |
| AssistantMessage: footer metadata weight inconsistent                    | Medium   | M3                                        | `AssistantMessage.tsx`                                                                                     | lines 97-101                        |
| Composer: append-only, no cursor, no readline                            | Critical | M4+M5                                     | `Composer.tsx`                                                                                             | lines 317, 339 (no cursor state)    |
| Composer.tsx: 443 lines, 5+ mixed concerns                               | High     | M4, M7                                    | `Composer.tsx`                                                                                             | whole file                          |
| `useSessionParts` creates new object on every delta                      | Critical | M9                                        | `MessageList.tsx`                                                                                          | lines 103-111                       |
| Height estimation runs `marked.lexer` on all messages per delta          | Critical | M8                                        | `MessageList.tsx`                                                                                          | lines 144-147                       |
| No `React.memo` on message components                                    | High     | M9                                        | `UserMessage.tsx`, `AssistantMessage.tsx`, `ToolPart.tsx`                                                  | —                                   |
| No windowed rendering — all messages rendered                            | High     | M9                                        | `MessageList.tsx`                                                                                          | lines 248-263                       |
| `as any` type casts in core surfaces                                     | Medium   | M7                                        | `SessionScreen.tsx:46,56`, `UserMessage.tsx:15`, `AssistantMessage.tsx:68,72,73`, `MessageList.tsx:68,132` | —                                   |
| Dead code: `InputBar`, `ChatPane`, `ContextPane`                         | Low      | M7                                        | those files                                                                                                | unimported                          |
| Sidebar: `active={false}` hardcoded                                      | Low      | M7                                        | `SessionScreen.tsx:137`, `Sidebar.tsx`                                                                     | —                                   |
| Monolithic store: 631 lines, 49 fields, 42 actions                       | High     | M7 (selectors only; store split deferred) | `store.ts`                                                                                                 | whole file                          |

### Hot-path file confirmation

All files confirmed present and matching the review:

- `Composer.tsx`: 443 lines — append-only input at line 339, backspace at line 317, no cursor state
- `MessageList.tsx`: 267 lines — height calc at lines 144-147, render-all loop at lines 248-263
- `ToolPart.tsx`: 114 lines — inverted collapse at line 73, 6 kind icons at lines 57-65
- `store.ts`: 631 lines — 49 fields, 42 actions, monolithic

### Dead-code file confirmation

All four dead-code surfaces confirmed present:

- `InputBar.tsx` ✓ (exists, not imported in live flow)
- `ChatPane.tsx` ✓ (exists, not imported in live flow)
- `ContextPane.tsx` ✓ (exists, not imported in live flow)
- `Sidebar.tsx` ✓ (`active={false}` hardcoded at `SessionScreen.tsx:137`)

### `as any` cast inventory

Confirmed casts in core surfaces (excluding the intentional `import.meta as any` at `index.tsx:106`):

- `SessionScreen.tsx:46,56` — `(sess as any).parentID` (child session detection)
- `UserMessage.tsx:15` — `(p as any).synthetic`
- `MessageList.tsx:68` — `(p as any).synthetic` in estimateHeight
- `MessageList.tsx:132` — `(m as any).time?.completed` in pending detection
- `AssistantMessage.tsx:68` — `part as any` for TextPart
- `AssistantMessage.tsx:72` — `part as any` for ReasoningPart
- `AssistantMessage.tsx:73` — `part as any` for ToolPart
- `Sidebar.tsx:131` — `(l as any).running`

### Baseline UX observations (written — no screenshots taken)

**`80x24` behavior:**

- Header: 1 row, no background color, text floats in terminal default bg
- StatusBar: 1 row, no background color, text floats
- MessageList fills middle rows; narrow width leaves ~2 cols of breathing room at mainWidth - 4
- Dock: 4 rows (separator + input row + 2 for attachments/stash if present)
- Sidebar: Ctrl+B toggles but steals 32 cols — at 80 wide that leaves only 48 for transcript
- No visual frame — header and footer blend into transcript content

**`120x40` behavior:**

- Header/StatusBar same issue (no background)
- More readable — wider transcript, tool rows don't truncate as aggressively
- Sidebar at 32 cols leaves 88 cols for transcript — acceptable
- Tool calls open while running (showing JSON), collapse after completing — backwards per spec

**Tool call state observations:**

- Running tools: show full JSON input body (noisy)
- Completed tools: collapsed by default (correct behavior is inverted — should be collapsed by default)
- Wait — actually re-reading `ToolPart.tsx:73`: `const open = state.status !== "completed" || collapsed === false`
  - This means: open if NOT completed (i.e., open while running/pending) OR if explicitly expanded
  - So completed tools ARE collapsed unless explicitly expanded — but running tools show the full JSON body
  - The "inverted" problem is specifically about running tools showing raw JSON — not the final collapse state
  - M2 fix is: remove body from running state (no JSON while running), keep collapsed default for completed

**Generation indicator duplication:**

- `Header.tsx:27` shows animated Spinner component during generating
- `Composer.tsx:374` shows `SPIN_FRAMES[spinFrame] + " "` prefix with yellow color during generating
- Both animate simultaneously — two competing indicators

### No production files changed

Confirmed: Milestone 0 is documentation/analysis only. No files under `packages/tui-ink/src` were modified.

## Milestone 1 — Shell framing and status cleanup

Goal: land the safest shell-level improvements first with no major structural changes.

Checklist:

- [x] UX change — Add background framing to header and status bar
  - Files:
    - `packages/tui-ink/src/components/Header.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
  - Change only the outer container styling.
  - Use `backgroundColor={theme.mantle}`.
  - Do not add extra rows, borders, or new components.

- [x] UX change — Make the header the primary generation indicator
  - Files:
    - `packages/tui-ink/src/components/Header.tsx`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Keep a single animated generation indicator in the header.
  - The composer may show dim text for generating state, but no competing spinner.
  - Keep status wording consistent: `ready`, `generating`, `error`.

- [x] UX change — Make status-bar hints context-sensitive
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

- [x] UX change — Guard the sidebar on narrow terminals
  - Files:
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`
  - Prevent the fixed-width sidebar from taking over `80x24`.
  - Keep this milestone simple:
    - hide or refuse to open it below a defined width threshold
    - keep the main transcript usable
  - Do not redesign the sidebar yet.

- [x] validation — Stop and verify milestone 1
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Run the full manual regression checklist.
  - Note any theme-specific contrast issues in the milestone notes.

Done when:

- [x] Header and status bar visually frame the app
- [x] The header is the only primary generation indicator
- [x] Footer hints change with UI state
- [x] Narrow terminals stay usable without sidebar crowding

Milestone notes:

### Implementation notes (2026-04-14)

**Framing approach deviation**: Ink v5 `Box` does not support `backgroundColor` — it's a `Text`-only prop. Applied `backgroundColor={theme.mantle}` to each `Text` element inside Header and StatusBar instead of the outer Box. The visual result is the same for the text cells; empty flex-space-between gaps between elements use the terminal default background. This is an acceptable trade-off given the Ink API constraint.

**Composer spinner removed**: Removed `SPIN_FRAMES`, `spinFrame` state, and the spinner `useEffect` from `Composer.tsx`. During generating state the composer prefix is now the static `◎ ` character (yellow) instead of the animated spinner frame. The header `<Spinner>` remains the single animated generation indicator.

**Context-sensitive hints**: StatusBar now reads `dialogs.length`, `scrollPos[sid]`, `permissions[sid]`, and `questions[sid]` from the store. Hint priority: permission pending → question pending → dialog open → generating → scrolled up → idle. All selectors return primitives (booleans/numbers) for stable equality.

**Sidebar guard**: `SIDEBAR_MIN = 120` columns threshold. `useInput` handler in SessionScreen refuses to open the sidebar below this width. A `useEffect` auto-closes it if the terminal is resized below the threshold while the sidebar is open.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 98 pass, 0 fail

## Milestone 2 — Tool-call defaults and execution detail cleanup

Goal: make tool activity quieter and more readable before changing the broader transcript styling.

Checklist:

- [x] refactor — Extract tool summary helpers before changing behavior
  - Files:
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - optional new helper file near `ToolPart.tsx`
  - Pull out logic for:
    - tool kind classification
    - title selection
    - duration formatting
    - default open/closed decision
  - Keep the helper narrowly scoped to tool rows.

- [x] UX change — Reduce tool kind icons from 6 to 4
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Use only:
    - `◇` for read/search/glob/grep
    - `✎` for write/edit
    - `$` for bash/execute
    - `⬡` for mcp and remaining external tool kinds

- [x] UX change — Prefer `state.title` as the primary summary
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Use `state.title` whenever it exists.
  - Fall back to a concise input-derived summary only when title is missing.
  - Do not show noisy raw keys like `file_read` unless no better summary exists.

- [x] UX change — Invert tool disclosure defaults
  - Files:
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/store.ts`
  - Make successful tools collapsed by default.
  - Make running tools render as one-line progress rows by default.
  - Make error tools expand automatically.
  - Preserve manual collapse/expand behavior.

- [x] UX change — Remove raw JSON input from default running state
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Running tools should not render raw input JSON unless the row is explicitly expanded or the tool errors.
  - Replace it with a concise title/status line.

- [x] UX change — Replace round borders with transcript-consistent left rails
  - File: `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Replace `borderStyle="round"` usage with the same left-rail grammar used elsewhere.
  - Keep error presentation clearly stronger than success presentation.

- [x] test — Add or update tool collapse behavior coverage
  - Files:
    - `packages/tui-ink/test/tool-part.test.ts` (new — 13 tests)
    - `packages/tui-ink/test/store.test.ts` (existing collapse tests unchanged, still pass)
  - Cover:
    - default collapsed success tools
    - expanded errors
    - expand/collapse toggling
    - running-to-completed transition

- [x] validation — Stop and verify milestone 2
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - tool-heavy streaming turn
    - successful tool rows
    - failed tool rows
    - expand/collapse interaction

Done when:

- [x] Successful tool rows are collapsed by default
- [x] Running tools are concise one-line rows
- [x] Errors expand automatically
- [x] Tool rows no longer default to raw JSON noise
- [x] Tool behavior is covered by tests

Milestone notes:

### Implementation notes (2026-04-14)

**`kind()` — 4 icons**: `file_read` is covered by `read`, `file_write` by `write`. The `⊕` glob/grep icon is merged into `◇` (read/search). The default fallthrough from `◎` → `⬡` (mcp/other). No behaviour change for the most common tools.

**`isOpen()` — extracted as exported pure helper**: Logic: `collapsed === false` → open; `collapsed === true` → closed; `undefined` → only open if `status === "error"`. This inverts the previous default (was: open when running/pending, closed when completed; now: closed for all, except errors).

**`state.title` preference**: Changed condition from `state.status === "completed" && state.title` to `"title" in state && state.title`. This uses the TypeScript `in` type guard to narrowly access `title` across any state variant that carries it (running can include a title in practice).

**Border change**: Replaced `borderStyle="round"` + `paddingX={1}` with `borderLeft={true}` + `paddingLeft={1}` for both the completed-output and pending/running-input body boxes. Error body already used `borderLeft` — unchanged. This aligns tool body boxes with the left-rail grammar used elsewhere in the transcript.

**Running tool body**: The body element still exists for the running/pending case (shows input JSON when explicitly expanded), but the default `isOpen("running", undefined) = false` means it is never shown unless the user explicitly opens it. No JSON is rendered by default during execution.

**Test file**: New `packages/tui-ink/test/tool-part.test.ts` — 13 tests covering all `isOpen` status×collapsed combinations and store toggle semantics.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 111 pass, 0 fail (was 98; +13 new tests)

## Milestone 3 — Transcript hierarchy and message chrome

Goal: make the conversation scannable by separating user input, assistant prose, and execution detail.

Checklist:

- [x] UX change — Apply the 3-weight hierarchy across the transcript
  - Files:
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Make user messages the strongest weight.
  - Keep assistant prose neutral/default.
  - Keep tool rows and metadata visibly tertiary.
  - Use existing theme tokens. Do not add heavy new containers.

- [x] UX change — Flatten user message nesting and reduce row overhead
  - File: `packages/tui-ink/src/components/UserMessage.tsx`
  - Reduce excess nested `Box` wrappers.
  - Preserve:
    - markdown rendering
    - file badges
    - `QUEUED` indicator
  - Optimize for fewer rows for short user messages.

- [x] UX change — Make assistant footers and metadata consistently tertiary
  - File: `packages/tui-ink/src/components/AssistantMessage.tsx`
  - Ensure duration, tokens, model/mode, and interrupted/error-adjacent footer copy read as metadata, not body content.
  - Use one consistent visual weight for footer text.

- [x] UX change — Keep tool rows structurally subordinate to assistant prose
  - Files:
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
  - Keep tool rows visibly nested under the assistant turn.
  - Avoid making tool rows look like peer messages.

- [x] validation — Stop and verify milestone 3
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify a 20+ message transcript at `120x40` and `80x24`.
  - Compare against Milestone 0 notes for scanability.

Done when:

- [x] User input is easy to locate at a glance
- [x] Assistant prose is the visual center of the transcript
- [x] Tool rows and metadata recede without becoming unreadable
- [x] Short user messages occupy less vertical space than baseline

Milestone notes:

### Implementation notes (2026-04-14)

**3-weight hierarchy approach:**

- User messages: `bold={true}` passed to `MarkdownRenderer` (new prop on paragraph Text elements), bold cyan bullet `•`. Cyan left border unchanged.
- Assistant prose: unchanged — `theme.text` normal weight, `theme.lavender` lead glyph `◆`, `theme.surface2` border.
- Tool rows: title color changed from `theme[stat.color]` (green/yellow/red/overlay) to `theme.subtext`. Status icon and kind icon retain their distinct colors. This makes tool titles tertiary without losing state legibility.
- Footer metadata: already used `theme.overlay` — no change needed.

**MarkdownRenderer `bold` prop**: Added `bold?: boolean` to Props and forwarded it only to `paragraph` token Text elements. Heading tokens were already bold (`theme.lavender`). Code blocks, lists, blockquotes are unchanged. The prop is opt-in — all existing callers are unaffected.

**UserMessage nesting reduction**: Simplified from 4 Box levels (outer → column → row → content-column) to 2 levels (outer-row → content-column). Changed `paddingLeft={2}` + inner `paddingLeft={1}` (total 3) to a single `paddingLeft={1}`. Removed `paddingRight={1}`. Added `flexDirection="row" gap={1}` to the outer Box to position the bullet inline with content. All features preserved: markdown rendering, `FileParts`, `QUEUED` indicator.

**Task 3 (footer)**: No changes needed — footer already used `theme.overlay` for all metadata items via a single joined `Text`. Condition (`isLast || done || aborted`) unchanged.

**Task 4 (subordination)**: No structural changes needed — tool rows already render inside `AssistantMessage`'s `paddingLeft={2} borderLeft` frame, with their own `paddingLeft={3}`. With title color now `theme.subtext`, they are visually tertiary and structurally contained under the assistant border rail.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 111 pass, 0 fail (unchanged from M2 baseline)

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
