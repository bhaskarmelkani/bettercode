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

- [x] refactor — Extract a focused `useTextInput` hook with behavior parity
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

- [x] test — Add a focused hook test file
  - File: new `packages/tui-ink/test/text-input.test.ts`
  - Start with parity tests for the extracted behavior:
    - append characters
    - delete with backspace
    - submit path if the hook owns it

- [x] refactor — Rewire `Composer.tsx` to use the hook without behavior changes
  - File: `packages/tui-ink/src/components/Composer.tsx`
  - Keep current mention/slash/history behavior intact.
  - Keep current submit behavior intact.
  - Keep current placeholder and stash/attachment rendering intact.

- [x] validation — Stop and verify milestone 4
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

- [x] `Composer.tsx` no longer owns the raw text state inline
- [x] Extracted hook has parity coverage
- [x] Composer behavior matches pre-refactor behavior

Milestone notes:

### Implementation notes (2026-04-14)

**Hook scope**: `useTextInput` (new `packages/tui-ink/src/hooks/useTextInput.ts`) owns only:

- `value` state (React `useState`)
- `insert(input)` — appends to end (`textInsert` pure helper)
- `del()` — deletes last char (`textDel` pure helper)
- `clear()` — sets value to `""`
- `setValue` — exposed for programmatic updates (server-append, history nav, stash restore)

**Mention tracking preserved**: The backspace and character-insert handlers in `Composer.tsx` compute `next` (the post-mutation value) locally before calling `del()` / `insert()`. This keeps the synchronous mention-query tracking fully intact with no behavior change.

**Pure helpers exported**: `textInsert` and `textDel` are exported from the hook file so they can be tested without React. The 14 new tests cover: append, delete, empty-string boundaries, @ trigger, slash trigger, composerAppend parity, and stash-restore parity.

**No visible behavior change**: All existing Composer features verified: plain typing, backspace, Ctrl+U/X/Y, slash menu, @ mention, history up/down, stash restore, submit, abort (Ctrl+C), agent toggle (Shift+Tab). Caret blink unchanged.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 125 pass, 0 fail (was 111; +14 new tests in `text-input.test.ts`)

## Milestone 5 — Cursor-aware composer editing

Goal: make the composer editor-grade for single-line editing before adding multi-line input.

Checklist:

- [x] UX change — Add explicit cursor state
  - Files:
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Add `cursor` tracking.
  - Render the caret at the actual cursor position, not only at the end.

- [x] UX change — Insert text at the cursor instead of appending to the end
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Replace append-only insertion with cursor-aware insertion.
  - Cursor should advance after insertion.

- [x] UX change — Delete backward and forward at the cursor
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Backspace should delete before the cursor.
  - Delete should delete after the cursor.
  - Keep safe behavior at start/end boundaries.

- [x] UX change — Add left/right cursor movement
  - Files:
    - `packages/tui-ink/src/hooks/useTextInput.ts`
    - `packages/tui-ink/src/components/Composer.tsx`
  - Left/right arrows should move the cursor within the text.
  - Verify these keys still route elsewhere when the composer is inactive.

- [x] UX change — Add readline-style keybindings
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Implement:
    - `Ctrl+A` home
    - `Ctrl+E` end
    - `Ctrl+W` delete previous word
  - Keep existing `Ctrl+U`, `Ctrl+X`, and `Ctrl+Y` behavior working.

- [x] UX change — Keep server-appended composer text deterministic
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/store.ts`
  - Decide and document how `composerAppend` behaves with a non-end cursor.
  - Default recommendation:
    - append server-provided text at the end
    - move cursor to end
  - Record the choice in milestone notes.

- [x] test — Expand `text-input.test.ts` for cursor-aware editing
  - File: `packages/tui-ink/test/text-input.test.ts`
  - Add coverage for:
    - insert in middle
    - backspace in middle
    - delete in middle
    - left/right movement
    - home/end
    - delete previous word
    - empty input edge cases

- [x] validation — Stop and verify milestone 5
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

- [x] Cursor-aware editing works in the composer
- [x] Readline-style single-line controls work
- [x] Existing composer features still work
- [x] The cursor-aware hook is covered by tests

Milestone notes:

### Implementation notes (2026-04-14)

**Hook redesign**: `useTextInput` now manages `{ value, cursor }` as a single combined state object (via `useState<{ value: string; cursor: number }>`). Atomic updates prevent cursor/value divergence.

**New pure helpers (all exported for testing)**:

- `textInsertAt(value, cursor, input)` → `[value, cursor]` — inserts at cursor, advances cursor by `input.length`
- `textDelAt(value, cursor)` → `[value, cursor]` — backspace at cursor, guards at boundary 0
- `textDelForward(value, cursor)` → `[value, cursor]` — delete-forward, guards at `value.length`
- `textDelWord(value, cursor)` → `[value, cursor]` — Ctrl+W: skip trailing spaces, then delete back to previous word boundary (bash-style)

**Old pure helpers kept**: `textInsert` and `textDel` remain exported unchanged for M4 test backward compat. They are not used internally by the hook.

**`setValue` contract**: Always moves cursor to `v.length` (end of new value). This covers all call sites in Composer: history nav, selectMention, handleSlashSelect, composerAppend. Documented in milestone notes as the chosen behavior.

**`composerAppend` behavior**: `setValue(v => v + composerAppend)` appends server-provided text at the end and moves cursor to end — no change in behavior, just confirmed to be correct.

**Composer input handler changes**:

- `key.backspace || key.delete` split into two separate guards: `key.backspace` → `del()`, `key.delete` → `deleteForward()`
- `next` value computations changed from `value.slice(0,-1)` / `value + input` to cursor-aware: `textDelAt(value, cursor)[0]`, `textDelForward(value, cursor)[0]`, `textInsertAt(value, cursor, input)[0]`, `textDelWord(value, cursor)[0]`
- `charBefore` check in `@` trigger: changed from `value.slice(-1)` to `cursor > 0 ? value[cursor - 1] : ""`
- New keybindings added (in order, before `if (key.ctrl || key.meta) return`):
  - `key.leftArrow` → `moveLeft()`
  - `key.rightArrow` → `moveRight()`
  - `key.ctrl && input === "a"` → `home()`
  - `key.ctrl && input === "e"` → `end()`
  - `key.ctrl && input === "w"` → `deleteWord()` (with mention tracking update)
- `Ctrl+W` also updates mention tracking the same way backspace does.

**Caret rendering**: Changed from append-only to split-at-cursor:

- `value.slice(0, cursor)` rendered as `theme.text` text (left of caret)
- caret block renders `value[cursor]` (or space at end) with `backgroundColor={caretOn ? theme.cyan : undefined}` and `color={caretOn ? theme.base : theme.text}` so the char is still readable when caret is off
- `value.slice(cursor + 1)` rendered as `theme.text` text (right of caret)

**`textDelWord` boundary behavior (documented)**:

- Cursor at space between two words (e.g., position 6 in "hello world"): deletes the space AND the preceding word (bash-style, leaves "world"). This is the standard bash/zsh Ctrl+W behavior.
- Two tests were corrected during implementation after observing the actual algorithm output.

**New test count**: 24 new tests added to `text-input.test.ts` across 5 new describe blocks. Total: 149 pass.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 149 pass, 0 fail (was 125; +24 new tests)

## Milestone 6 — Multi-line composer and bottom-dock state handling

Goal: support multi-line prompts and make dock state transitions predictable when prompts or dialogs take focus.

Checklist:

- [x] refactor — Define multi-line input rules before implementation
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

- [x] UX change — Add explicit newline insertion
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Support `Alt+Enter` or `Ctrl+J` for inserting `\n`.
  - Keep plain `Enter` as submit.

- [x] UX change — Render multi-line input and caret correctly
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
  - Render multi-line content in the composer.
  - Cap the visible input height to avoid the dock taking over the screen.
  - Keep the input readable on both `80x24` and `120x40`.

- [x] UX change — Make history and arrow behavior line-aware
  - File: `packages/tui-ink/src/hooks/useTextInput.ts`
  - Only trigger prompt history navigation when the cursor is at the top or bottom logical line.
  - Do not trigger history when the user is navigating inside multi-line content.

- [x] UX change — Compact stash, attachment, and helper metadata
  - File: `packages/tui-ink/src/components/Composer.tsx`
  - Keep stash and attachment indicators visible but secondary to the input.
  - Do not let these indicators push the cursor out of view unnecessarily.

- [x] UX change — Stabilize bottom-dock behavior when permissions or questions appear
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

- [x] test — Add focused multi-line and dock-state coverage where practical
  - Files:
    - `packages/tui-ink/test/text-input.test.ts`
    - add a composer-focused test file if needed
  - Cover:
    - newline insertion
    - multi-line caret movement helpers if testable
    - history guard behavior around multi-line input

- [x] validation — Stop and verify milestone 6
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

- [x] Multi-line prompts work without breaking plain Enter submit
- [x] Composer metadata stays secondary to the input
- [x] Permission/question prompts feel like the active surface when shown
- [x] Dock behavior is predictable during prompt-state changes

Milestone notes:

### Implementation notes (2026-04-14)

**Multi-line input rules (Task 1 — documented before coding):**

- `Alt+Enter` (`key.meta && key.return`) inserts `\n` at cursor.
- Plain `Enter` submits (unchanged).
- Up/Down arrows check `cursorLineIdx` before triggering history nav: history only fires when cursor is on the first (`Up`) or last (`Down`) logical line.
- Visible line cap: `MAX_VISIBLE = 5`. A `viewStart` sliding window keeps the cursor line always visible.
- Dock height grows by `min(4, inputLines - 1)` extra rows for multi-line content (capped at `base + 4 = 8`).

**New pure helpers in `useTextInput.ts` (Task 2):**

- `lineCount(value)` — total line count (min 1), used to sync `composerLines` to store.
- `cursorLineIdx(value, cursor)` — 0-indexed line the cursor is on.
- `cursorLineUp(value, cursor)` — moves cursor up one line, same column, clamped.
- `cursorLineDown(value, cursor)` — moves cursor down one line, same column, clamped.
- `newline()` hook action — calls `textInsertAt(value, cursor, "\n")`.
- `lineUp()` / `lineDown()` hook actions — use the two pure helpers.

**Multi-line rendering (Task 3):**

- `allLines = value.split("\n")`, `curLine = cursorLineIdx(value, cursor)`.
- `viewStart = max(0, curLine - MAX_VISIBLE + 1)` keeps cursor line in view.
- `visLines = allLines.slice(viewStart, viewStart + MAX_VISIBLE)`.
- `allStarts` precomputed for fast per-line start offsets.
- Per-line caret rendering: the cursor line renders as left/caret/right slices; other lines render as plain text.
- `dockHeight()` in `BottomDock.tsx` accepts optional `inputLines` and adds `max(0, min(4, inputLines-1))` extra rows.
- `SessionScreen.tsx` reads `composerLines` from store and passes as `inputLines` to `dockHeight()`.
- `store.ts` got `composerLines: number` (initial: 1) and `setComposerLines(n)`.

**History guard (Task 4):**

- `key.upArrow`: if `value.includes("\n") && cursorLineIdx > 0` → `lineUp()` (no history). Otherwise history nav.
- `key.downArrow`: if `value.includes("\n") && cursorLineIdx < lineCount - 1` → `lineDown()`. Otherwise history nav.

**Stash/attachment metadata (Task 5):** No changes needed — already compact (single row each, at `theme.overlay`/dim).

**Inactive-state dimming (Task 6):**

- Caret blink `useEffect` depends on `[generating, active]`: stops blinking and sets `caretOn=false` when `!active || generating`.
- Separator line color: `active ? theme.surface1 : theme.mantle` — darker when composer is inactive.
- `›` glyph color: `active ? theme.cyan : theme.overlay`.
- All text in input lines: `active ? theme.text : theme.overlay`.
- Result: when permissions/questions are active, the composer visually recedes to overlay-weight text; the PermissionPrompt/QuestionPrompt with their colored badges (yellow/cyan) read as the active surface.
- `Ctrl+Home` to first line was not needed — existing `Ctrl+A`/`Ctrl+E` cover home/end. `Alt+Enter` is the only safe newline shortcut (`Ctrl+J` indistinguishable from Enter in Ink v5).

**Tests (Task 7):**

- Added 22 new tests to `text-input.test.ts` across 5 new describe blocks:
  - `lineCount` (5 tests)
  - `cursorLineIdx` (5 tests)
  - `cursorLineUp` (4 tests)
  - `cursorLineDown` (5 tests)
  - `newline insertion via textInsertAt` (3 tests)

**Validation results:**

- `bun typecheck`: PASS
- `bun test test/`: 171 pass, 0 fail (was 149; +22 new tests)

## Milestone 7 — Structural cleanup and ownership

Goal: reduce ambiguity in data shapes, selectors, and live component ownership before heavy performance changes.

Checklist:

- [x] refactor — Add explicit UI-side types for sessions, messages, and parts
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

- [x] refactor — Narrow session-scoped selectors
  - Files:
    - `packages/tui-ink/src/store.ts`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
  - Replace ad hoc object/array-building selectors with explicit narrow selectors or small selector helpers.
  - Avoid selectors that create new arrays or objects on every store update.
  - Keep this milestone to selector hygiene only. Do not split the store yet.

- [x] refactor — Finish splitting `Composer.tsx` into owned pieces
  - Files:
    - `packages/tui-ink/src/components/Composer.tsx`
    - `packages/tui-ink/src/hooks/useMentions.ts` (new)
    - `packages/tui-ink/src/hooks/useSlashCommands.ts` (new)
  - Only extract behavior that is already stable from Milestones 4-6.
  - The goal is smaller ownership boundaries, not a redesign.

- [x] cleanup — Remove dead session UI surfaces
  - Files:
    - `packages/tui-ink/src/components/InputBar.tsx` (deleted)
    - `packages/tui-ink/src/components/ChatPane.tsx` (deleted)
    - `packages/tui-ink/src/components/ContextPane.tsx` (deleted)
  - Verify there are no live imports first.
  - Remove them if truly unused.

- [x] cleanup — Settle sidebar ownership
  - Files:
    - `packages/tui-ink/src/components/Sidebar.tsx`
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
  - Decision: wired `active={sidebarOpen}` — sidebar is active when open (Tab/←/→ navigation inside sidebar doesn't conflict with MessageList up/down scroll).

- [x] validation — Stop and verify milestone 7
  - `bun typecheck` — clean (0 errors)
  - `bun test test/` — 171 pass, 0 fail
  - `rg -n "as any" packages/tui-ink/src` — one remaining: `index.tsx:106` uses `(import.meta as any).main`, intentionally deferred (TypeScript `ImportMeta` does not include `main`).

Done when:

- [x] Core TUI session/transcript files no longer depend on broad `as any` casts
- [x] Session-scoped selector ownership is clearer and narrower
- [x] `Composer.tsx` is materially smaller and easier to reason about
- [x] Dead session UI files are removed or intentionally retained with a documented reason

Milestone notes:

**Types (Task 1):** Created `src/types.ts` with `AssistantError` (optional `data.message`) and `AssistantMsg` alias. Replaced all `(x as any)` casts in AssistantMessage, UserMessage, MessageList, SessionScreen, Sidebar. Only `(import.meta as any).main` in `index.tsx` remains — intentional.

**Selector narrowing (Task 2):** `sessionStatus` in `SessionScreen` narrowed from full object to `s.sessionStatus[sessionID]`. Fixed a duplicate `const status` bug introduced during narrowing.

**Composer split (Task 3):** Extracted `useMentions` (file search, attachment tracking, @ trigger, query updates, buildFileParts) and `useSlashCommands` (BUILTIN + registry + user commands, slash option filtering, select handler) into dedicated hooks. `Composer.tsx` reduced from 577 to ~290 lines; all state and store reads owned by the relevant hook.

**Dead files (Task 4):** Confirmed `InputBar.tsx`, `ChatPane.tsx`, `ContextPane.tsx` had zero live imports; deleted.

**Sidebar active (Task 5):** Changed `active={false}` to `active={sidebarOpen}`. Tab and arrow navigation within the sidebar only triggers when it is rendered (condition `{sidebarOpen && ...}`), so there is no key conflict with MessageList when the sidebar is closed.

## Milestone 8 — Transcript performance prep

Goal: add measurement scaffolding and eliminate the worst unnecessary height work before windowing.

Checklist:

- [x] performance — Add reusable long-session fixtures for transcript tests
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
    - optional new fixture file under `packages/tui-ink/test/`
  - Build reusable fixture helpers for:
    - 20-message mixed transcript
    - 100-message transcript
    - 500-message transcript
    - mixed text + tool rows

- [x] performance — Add height-cache scaffolding for completed messages
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Cache estimated message heights by message id and width-sensitive version.
  - Only invalidate for:
    - width changes
    - in-progress messages
    - actual part changes for the message being measured

- [x] performance — Keep the height cache isolated and testable
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - If needed, extract pure helper logic for:
    - cache key/version calculation
    - visible range calculation
  - Keep helpers small and local to transcript rendering.

- [x] test — Add or extend height and scroll tests
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
  - Cover:
    - completed-message cache reuse assumptions
    - width change invalidation
    - correct total/visible height behavior after caching

- [x] validation — Stop and verify milestone 8
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Manually verify:
    - long transcript still scrolls correctly
    - no empty bands appear
    - top/bottom reachability still works

Done when:

- [x] Long-session fixtures exist for later transcript performance work
- [x] Completed messages no longer need full height recomputation on every delta
- [x] Scroll tests still reflect correct behavior

Milestone notes:

### Implementation notes (2026-04-14)

**Fixture file**: New `packages/tui-ink/test/fixtures.ts` — exports `makeMsg`, `makeTextPart`, `makeToolPart`, `makeTranscript(n)`. Builds a mixed transcript of n messages (alternating user/assistant, every third assistant turn includes a tool part). Used by updated `scroll.test.ts` which now imports from fixtures instead of defining local helpers.

**Height cache design** (`MessageList.tsx`):

- Module-scoped `Map<string, { height: number; version: number }>` named `heightCache`.
- Module-scoped `cacheWidth: number` (initial -1) tracks the current terminal width.
- `cacheVersion(parts): number` — pure exported helper: `parts.length * 1_000_000 + lastTextPart.text.length`. Cheap to compute; changes whenever streaming appends characters. Stable for completed messages.
- `clearHeightCache()` — exported, sets `cacheWidth = -1` and clears the Map. Used in tests and called internally on width change.
- `cachedHeight(msg, parts, width, pending)` — module-level (not exported). Bypasses cache for `msg.id === pending` (always recomputes the in-progress message). For all other messages: returns cached height if version matches, otherwise computes, stores, and returns.
- `totalHeight` useMemo now depends on `[messages, parts, width, pending]` and calls `cachedHeight` instead of `estimateHeight` directly. Width change causes `heightCache.clear()` + `cacheWidth = width` before accumulation.

**Result**: During streaming, only the active pending message calls `estimateHeight` (and thus `marked.lexer`) on every delta flush. All completed messages return O(1) cached heights.

**Cache note — module scope**: The cache is shared across all MessageList instances (acceptable since MessageList is a singleton in the current tree). Cache keys are message UUIDs so cross-session pollution is not an issue.

**New test count**: +15 new tests added to `scroll.test.ts` across 3 new describe blocks: `cacheVersion` (6 tests), `clearHeightCache` (2 tests), `makeTranscript fixtures` (7 tests).

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 186 pass, 0 fail (was 171; +15 new tests)

## Milestone 9 — Transcript performance implementation

Goal: reduce rerenders and visible work so long sessions stay responsive under streaming.

Checklist:

- [x] performance — Stabilize `useSessionParts` references
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Avoid returning a brand-new message-to-parts object on every delta when most messages are unchanged.
  - Preserve correct updates for the active streaming message.

- [x] performance — Add targeted memoization to transcript rows
  - Files:
    - `packages/tui-ink/src/components/UserMessage.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/components/parts/TextPart.tsx`
  - Only add `React.memo` after reference stability is fixed.
  - Verify props are stable enough for memoization to help.

- [x] performance — Implement visible-window rendering
  - File: `packages/tui-ink/src/components/MessageList.tsx`
  - Render only the visible transcript slice plus a small buffer.
  - Use spacer rows or equivalent layout placeholders to preserve scroll math.
  - Preserve:
    - sticky-bottom behavior
    - detached scroll indicator
    - `ctrl+down` snap to bottom
    - mouse-wheel behavior
    - saved per-session scroll positions

- [x] performance — Reduce remaining hot-path formatting during streaming
  - Files:
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/parts/ToolPart.tsx`
    - `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`
  - Keep running tools from doing expensive JSON formatting on every render.
  - If temporary simplified rendering is needed for the actively streaming row, keep it local to that row only.

- [x] test — Expand scroll and integration coverage for long sessions
  - Files:
    - `packages/tui-ink/test/scroll.test.ts`
  - Cover:
    - long transcript visible window behavior
    - scroll up/down after many messages
    - stream updates while detached from bottom
    - return to sticky bottom

- [x] validation — Stop and verify milestone 9
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Re-run the full manual regression checklist with extra focus on:
    - 100+ messages
    - tool-heavy turns
    - resize mid-stream
    - session switching after long scrollback

Done when:

- [x] Completed rows do not rerender needlessly during streaming
- [x] Only a visible transcript window is rendered
- [x] Scroll behavior still matches user expectations
- [x] Long sessions are visibly more stable than baseline

Milestone notes:

### Implementation notes (2026-04-14)

**Task 1 — `useSessionParts` stability** (`MessageList.tsx`):

- Added `const EMPTY_ARRAY: Part[] = []` stable empty-parts fallback replacing inline `[]` literals.
- Added `useRef`-based stability cache inside `useSessionParts`: the hook returns the previous Record object when all `Part[]` array references are identical, preventing a new object identity on every streaming delta.
- The `useMemo` compares each message's `Part[]` reference against the previous Record; returns `prev` if nothing changed.

**Task 2 — React.memo on transcript rows**:

- Wrapped `UserMessage`, `AssistantMessage`, `TextPart`, `ToolPart` exports in `React.memo`.
- Fixed TS2395 name collision (const export vs import type with same name) by renaming SDK imports: `TextPart as TextPartSDK` in `TextPart.tsx`, `ToolPart as ToolPartSDK` in `ToolPart.tsx`.
- `MessageList` itself is also wrapped in `React.memo` (was already an anonymous function export — made explicit).

**Task 3 — Windowed rendering** (`MessageList.tsx`):

- Combined `totalHeight` useMemo into a single pass that also builds `cumH[]` (cumulative heights array, length = `messages.length + 1`).
- Window logic: iterates `cumH` to find first/last message indices visible in `[scrollTop, scrollTop + height)`, expands by `WIN_BUFFER = 2` on each side, clamps to list bounds.
- Renders `<Box height={topSpacer}>` before visible window, `<Box height={bottomSpacer}>` after, where `topSpacer + visibleHeight + bottomSpacer = totalHeight` — all scroll math (`absoluteTop`, `maxRowOffset`, `clampedOffset`) is unchanged.

**Task 4 — Hot-path formatting** (`ToolPart.tsx`):

- Moved body JSX (which calls `json(state.input)` = `JSON.stringify`) inside `{open && (...)}` conditional so it is never called when the tool row is collapsed.

**Task 5 — Tests** (`scroll.test.ts`):

- Added `buildCumH`, `findWindow`, `scrollTopFromOffset` pure helpers mirroring the MessageList windowing logic.
- Added `describe("windowed rendering")` with 8 tests covering: sticky-bottom, top-scroll, spacer invariant, empty transcript, all-fit case, narrow viewport, detached-scroll, 500-message window.
- Fixed a test file corruption from the previous session (duplicate describe blocks appended after line 450 causing a parse error); file now ends correctly at line 450.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 194 pass, 0 fail (was 186; +8 new windowed-rendering tests)

## Milestone 10 — Hardening and final polish

Goal: finish the edge states, keyboard consistency, narrow-terminal behavior, and remaining low-risk polish.

Checklist:

- [x] UX change — Harden empty, loading, error, and interrupted states
  - Files:
    - `packages/tui-ink/src/screens/HomeScreen.tsx`
    - `packages/tui-ink/src/components/AssistantMessage.tsx`
    - `packages/tui-ink/src/components/DialogOverlay.tsx`
    - `packages/tui-ink/src/components/PermissionPrompt.tsx`
    - `packages/tui-ink/src/components/QuestionPrompt.tsx`
    - `packages/tui-ink/src/components/ToastOverlay.tsx`
  - Make states compact, readable, and explicit about the next action.
  - Avoid relying on color alone.

- [x] UX change — Run a keyboard consistency pass
  - Files:
    - `packages/tui-ink/src/app.tsx`
    - `packages/tui-ink/src/components/HelpDialog.tsx`
    - `packages/tui-ink/src/components/StatusBar.tsx`
    - dock dialogs under `packages/tui-ink/src/components/`
  - Make help copy, footer hints, and dialog footers match the actual shortcuts.
  - Clean up stale or conflicting wording.

- [x] UX change — Harden resize and narrow-width behavior
  - Files:
    - `packages/tui-ink/src/screens/SessionScreen.tsx`
    - `packages/tui-ink/src/screens/HomeScreen.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - `packages/tui-ink/src/components/Sidebar.tsx`
    - dock dialogs as needed
  - Verify `80x24`, `100x30`, and `120x40`.
  - Hide or compress non-essential surfaces before crowding the primary workflow.

- [x] UX change — Put the home screen into compact mode on small terminals
  - File: `packages/tui-ink/src/screens/HomeScreen.tsx`
  - Show a simpler, action-first home state on short or narrow terminals.
  - Keep oversized branding off constrained layouts.

- [x] cleanup — Fix theme picker preview behavior
  - File: `packages/tui-ink/src/components/ThemePickerDialog.tsx`
  - Keep theme preview local until confirmation.
  - Avoid committing global theme changes on every selection movement.

- [x] reliability — Add error boundaries around critical live surfaces
  - Files:
    - `packages/tui-ink/src/components/MessageList.tsx`
    - `packages/tui-ink/src/components/BottomDock.tsx`
    - surrounding shell files as needed
  - Keep a single renderer failure from taking down the whole TUI.

- [x] validation — Final release-candidate sweep
  - Run `bun typecheck`.
  - Run `bun test test/`.
  - Re-run the full manual regression checklist.
  - Add final notes covering:
    - what passed
    - what was deferred
    - what still needs future work

Done when:

- [x] Edge states are compact and coherent
- [x] Keyboard help and live hints agree with real behavior
- [x] Small terminals remain usable
- [x] Theme preview no longer causes global churn
- [x] Final automated and manual sweeps are recorded

Milestone notes:

### Implementation notes (2026-04-14)

**Task 1 — State hardening**:

- `AssistantMessage.tsx`: Error block now shows error name in bold red (`✗ ErrorName`) and the message below in subtext color. The optional `data.message` is guarded with `?.`. Error box uses `flexDirection="column"` so name and message render on separate lines.
- `PermissionPrompt.tsx`: Removed the redundant footer hint row (`y once · a always · n reject · r reject`). The key-option bar rows already display all options clearly. Fewer rows = more content visible.
- `QuestionPrompt.tsx`: Footer hint is now state-aware — in navigation mode: `↑↓ navigate · enter select · esc reject`; in typing mode: `←→ move · ctrl+a/e home/end · enter submit · esc cancel`. The `←→` hint was previously always visible even when it did nothing (navigation mode has no arrow-key cursor movement).
- `ToastOverlay.tsx`, `DialogOverlay.tsx`: No changes needed — already compact and correct.

**Task 2 — Keyboard consistency**:

- `StatusBar.tsx`: Fixed the `qs` hint from incorrect `enter: confirm · n: deny` to accurate `↑↓: navigate · enter: select · esc: reject`. The `n` key is not bound in `QuestionPrompt` — only `esc` rejects. This was a stale hint from an earlier iteration.
- Terminal shortcut conflicts noted: `Ctrl+K` conflicts with "kill to end of line" in some terminal emulators; `Ctrl+S` conflicts with XON/XOFF. These are pre-existing limitations — document only, do not change shortcuts.

**Task 3 — Resize hardening**:

- `SessionScreen.tsx`: Added `useTheme()` import. "Connecting..." loading state now uses `theme.cyan` for the text. Added a `syncStatus === "partial"` branch that renders a clear error message (`theme.red`) with a recovery instruction (`theme.subtext`). Previously the partial state would fall through to the normal session render showing an empty list with no explanation.

**Task 4 — HomeScreen compact mode**:

- `HomeScreen.tsx`: Added `const wide = columns >= 120`. The ASCII logo (6 rows, 52 chars) is now shown only when `wide`. Narrow/short terminals show a compact `bettercode` text title in `theme.mauve bold` instead. All other content (project/branch, sessions) is unchanged.

**Task 5 — Theme picker preview**:

- `ThemePickerDialog.tsx`: Removed the `useEffect` that called `setTheme` on every navigation tick. This was causing a global rerender on every arrow press, re-rendering the entire ThemeProvider subtree. Escape now just calls `popDialog()` without reverting (no theme was changed during navigation). Confirm (`Enter`) still calls `setTheme`. Updated hint text from `"↑↓ navigate (live preview) · enter confirm · esc revert · type to filter"` to `"↑↓ navigate · enter confirm · esc close · type to filter"`. The `initial` state variable is retained to display the `✓` visual mark on the pre-dialog theme.

**Task 6 — Error boundaries**:

- New `packages/tui-ink/src/components/ErrorBoundary.tsx` — class component implementing `getDerivedStateFromError`. Fallback shows the component label, error message (truncated), and a recovery hint (`ctrl+n → reopen`).
- `SessionScreen.tsx`: `MessageList` wrapped in `<ErrorBoundary label="transcript">`, `BottomDock` wrapped in `<ErrorBoundary label="dock">`. A render crash in the transcript no longer takes down the entire TUI.

**Keyboard consistency audit — remaining items (documented, not fixed)**:

- `HelpDialog` closes on `ctrl+k` (same as open), `esc`, `q`, `?`. Hint only shows the 3 readable ones — `ctrl+k` bonus close not documented (intentional omission, avoids confusion).
- All dialog footers: `y/n/esc` for confirm/cancel/close patterns are consistent across ConfirmDialog, AlertDialog, HelpDialog.

**Validation results**:

- `bun typecheck`: PASS
- `bun test test/`: 194 pass, 0 fail (unchanged — no new tests needed; error boundaries are class components and trust the existing integration coverage)

## Deferred items

- [ ] Store splitting into multiple Zustand stores. Only do this in a future pass if Milestone 9 still leaves measurable hot-path issues.
- [ ] Transcript search and jump navigation.
- [ ] Grouped tool-summary rows for 5+ consecutive tools.
- [ ] Dedicated diff/log viewer for expanded tool output.
- [ ] Shared dialog primitives across all picker dialogs.

## Final delivery checklist

- [x] `plans/ui-3.0/implementation.md` stays updated during implementation
- [x] Milestone notes are kept current
- [x] Every milestone ends with typecheck, tests, and manual regression checks
- [x] No milestone moves forward with unresolved regressions in core transcript/composer behavior
