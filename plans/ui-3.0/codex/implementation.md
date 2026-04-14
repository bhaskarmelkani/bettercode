# BetterCode UI 3.0 — Implementation Plan

## How to use this file
OpenCode must execute one milestone at a time. Update TODO status markers in place while working: use `[~]` for the single task currently in progress, `[x]` when a task is complete, and `[!]` when a task is blocked. Keep the `Milestone notes` section for the active milestone current with decisions, blockers, regressions, and any deliberate deviation from this plan. Do not start the next milestone until the current one is stable enough, its acceptance criteria are met, and its validation steps have been run.

## Milestone 0 — Baseline and guardrails
### Objective
Establish an execution baseline, confirm the reviewed findings against the current codebase, and lock in the regression checklist before any UI changes land.

### Tasks
- [ ] validation — Map reviewed findings to concrete BetterCode files
  - Scope: Read `plans/ui-3.0/codex/final-codex-review.md` sections 4, 6, and 7 and write a short finding-to-file map in this milestone's notes before editing production code.
  - Why: The reviewed spec is the source of truth, but OpenCode should not infer where each finding belongs.
  - Files likely involved: `plans/ui-3.0/codex/final-codex-review.md`, `plans/ui-3.0/codex/implementation.md`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/store.ts`.
  - Implementation notes: The mapping should name the target milestone for each reviewed finding and call out any dependency, especially where a UX task depends on a refactor or test seam.
  - Acceptance criteria: Every planned change in Milestones 1-6 has a concrete target file list and no reviewed finding is left "somewhere in the TUI."
  - Validation: Re-read the mapping and confirm each item points to a real file via `rg --files packages/tui-ink/src`.

- [ ] validation — Capture the current UX baseline at small and normal terminal sizes
  - Scope: Launch BetterCode through the real entrypoint and record current behavior at `80x24` and `120x40` for the home screen, an idle session, a streaming session, a tool-heavy assistant turn, a permission prompt, a question prompt, a dialog opened from the dock, a sidebar toggle attempt, and a terminal resize.
  - Why: Later milestones need before/after comparisons for scroll, streaming, prompt handling, and resize behavior.
  - Files likely involved: `packages/opencode/bin/bettercode`, `packages/tui-ink/src/app.tsx`, `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: Put image paths or written observations in this milestone's notes. If screenshots are saved, store the paths in the notes instead of creating another tracking doc unless a separate artifact is genuinely useful.
  - Acceptance criteria: Baseline notes exist for both terminal sizes and cover the required surfaces.
  - Validation: Launch with `./packages/opencode/bin/bettercode` and verify the notes mention exact terminal sizes and what was observed.

- [ ] validation — Run the current package-local safety checks and record the baseline result
  - Scope: Run the existing typecheck and core TUI tests from `packages/tui-ink`, not from repo root, and record pass/fail results before any UI edits.
  - Why: OpenCode needs to know whether later failures are regressions or pre-existing.
  - Files likely involved: `packages/tui-ink/package.json`, `packages/tui-ink/test/scroll.test.ts`, `packages/tui-ink/test/store.test.ts`, `packages/tui-ink/test/integration.test.ts`.
  - Implementation notes: Use package-local commands only. Record flaky or pre-existing failures in this milestone's notes immediately.
  - Acceptance criteria: Baseline results are recorded for `bun typecheck` and the current focused test set.
  - Validation: Run `cd packages/tui-ink && bun typecheck` and `cd packages/tui-ink && bun test test/scroll.test.ts test/store.test.ts test/integration.test.ts`.

- [ ] validation — Freeze the regression checklist OpenCode will reuse after every milestone
  - Scope: Turn the required regression checks into a repeatable checklist in this milestone's notes: streaming sessions, large message history, collapsed/expanded tool calls, keyboard shortcuts, terminal resize, sidebar/dialog interactions, permission/question flows, and long-session stability.
  - Why: The same regression matrix must be rerun after each milestone; it should not be reinvented each time.
  - Files likely involved: `plans/ui-3.0/codex/implementation.md`.
  - Implementation notes: Keep the checklist concise and executable. Reuse the same terminal sizes and the same representative session scenarios throughout the project.
  - Acceptance criteria: The regression matrix is written once and is specific enough to execute without interpretation.
  - Validation: Confirm every required regression area from the user request appears in the checklist.

- [ ] validation — Stop and verify before milestone 1
  - Scope: Do not edit product code until the mapping, baseline capture, and test baseline are complete and recorded.
  - Why: This milestone exists to reduce avoidable regressions and sequencing mistakes.
  - Files likely involved: `plans/ui-3.0/codex/implementation.md`.
  - Implementation notes: If the baseline reveals a major mismatch with `final-codex-review.md`, record it in notes and resolve the mismatch before proceeding.
  - Acceptance criteria: Only planning notes changed in this milestone; no production UI files changed yet.
  - Validation: Review `git diff` and confirm production files under `packages/tui-ink/src` are untouched.

### Risks / regressions to watch
- Baseline observations may reveal code drift from the reviewed spec; record it before implementing anything.
- Running the app in different terminal sizes can expose resize bugs early; keep those notes because later milestones will depend on them.

### Definition of done
- The finding-to-file map is recorded.
- Baseline screenshots or notes exist for the required scenarios.
- Package-local typecheck and core tests have a recorded baseline result.
- A reusable regression checklist is written in the milestone notes.

### Milestone notes

## Milestone 1 — Quick wins
### Objective
Land low-risk visual and interaction improvements that make the shell calmer and more legible without changing transcript architecture.

### Tasks
- [ ] UX change — Add visual framing to the shell chrome
  - Scope: Add a stable background treatment to the header and status bar so the transcript feels framed instead of blending into the chrome.
  - Why: This is the fastest visible improvement and aligns directly with the reviewed recommendation to treat the shell like a window frame.
  - Files likely involved: `packages/tui-ink/src/components/Header.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`.
  - Implementation notes: Use the existing theme token recommended in the reviewed spec (`theme.mantle`). Do not add new borders or extra rows in this task.
  - Acceptance criteria: Header and status bar are visually anchored without changing layout height.
  - Validation: Manual check in `80x24` and `120x40`, plus `cd packages/tui-ink && bun typecheck`.

- [ ] UX change — Deduplicate generation indicators and normalize status wording
  - Scope: Make the header the primary place for ready/generating/error state and remove competing spinner language from the composer/status bar.
  - Why: The current UI shows generation state in too many places and splits user attention.
  - Files likely involved: `packages/tui-ink/src/components/Header.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/components/Composer.tsx`.
  - Implementation notes: The composer may still show dim explanatory text, but it should not compete with the header. Keep the state vocabulary consistent across all three surfaces.
  - Acceptance criteria: There is one primary generation indicator, and the same status words are used everywhere.
  - Validation: Start a streaming session and confirm header, status bar, and composer no longer show redundant live indicators.

- [ ] UX change — Make status-bar hints context-sensitive
  - Scope: Replace the two hardcoded hint strings with hints that adapt to idle, generating, scrolled-up, dialog-open, and permission/question states.
  - Why: Keyboard discoverability is currently weak and the footer should reflect the current focus target.
  - Files likely involved: `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/store.ts`, `packages/tui-ink/src/app.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`.
  - Implementation notes: Prefer reading existing store state over introducing new global flags. Include only the keys that matter for the current state.
  - Acceptance criteria: Footer hints change when a dialog is open, when a permission or question is pending, when the message list is detached from the bottom, and when the app is generating.
  - Validation: Manual regression through dialog open/close, scroll detachment, and prompt states.

- [ ] UX change — Add simple sidebar width guards and toggle hygiene
  - Scope: Prevent the sidebar from stealing space on narrow terminals and avoid showing a toggle path when the width is too small for it to be useful.
  - Why: The current fixed `32`-column sidebar is too expensive on an `80x24` terminal.
  - Files likely involved: `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`.
  - Implementation notes: This milestone is only for simple width gating. Do not redesign the sidebar yet. Full resize hardening stays in Milestone 6.
  - Acceptance criteria: At `80x24`, the sidebar does not consume layout width and the shell remains usable.
  - Validation: Manual check by toggling the sidebar at `80x24`, `100x30`, and `120x40`.

- [ ] validation — Stop and verify milestone 1
  - Scope: Re-run the Milestone 0 regression checklist after the shell quick wins land.
  - Why: These are low-risk changes, so regressions here mean the next milestones should not proceed yet.
  - Files likely involved: `packages/tui-ink/src/components/Header.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: Record any wording or layout deviations in this milestone's notes before moving on.
  - Acceptance criteria: The shell feels visually calmer, generation state is singular, footer hints are accurate, and narrow terminals remain usable.
  - Validation: Run `cd packages/tui-ink && bun typecheck`, then perform the full manual smoke checklist from Milestone 0.

### Risks / regressions to watch
- Header/status background changes can reduce contrast in some themes; verify at least the default theme and one non-default theme.
- Status hint logic can drift from actual shortcuts if it is not tied to real state; keep hints narrow and accurate.

### Definition of done
- Header and status bar frame the app cleanly.
- Only one primary generation indicator remains.
- Footer hints match the current focus and state.
- Narrow terminals no longer lose a large chunk of space to the sidebar.

### Milestone notes

## Milestone 2 — Message area and tool-call UX
### Objective
Make the transcript scannable by separating conversation from execution detail, using a clear visual hierarchy, and defaulting tool calls to progressive disclosure.

### Tasks
- [ ] refactor — Extract tool-row summary helpers before changing `ToolPart`
  - Scope: Move tool summary, kind icon, duration, and default-open decisions into pure helper logic so the later UX changes are testable and less fragile.
  - Why: `ToolPart.tsx` currently mixes formatting, disclosure state, and rendering in one component.
  - Files likely involved: `packages/tui-ink/src/components/parts/ToolPart.tsx`, `packages/tui-ink/src/components/parts/TextPart.tsx`, `packages/tui-ink/test`.
  - Implementation notes: A small sibling helper file such as `packages/tui-ink/src/components/parts/tool.ts` is appropriate if it makes tests straightforward. Keep it narrowly scoped to tool-row rendering logic.
  - Acceptance criteria: `ToolPart` render decisions rely on pure helpers instead of inlined string/summary logic.
  - Validation: Add focused helper coverage in `packages/tui-ink/test` or extend an existing test file if a dedicated one is not necessary.

- [ ] UX change — Apply a three-weight transcript hierarchy
  - Scope: Make user input the strongest weight, assistant prose the neutral/default weight, and tool/metadata output the lowest weight.
  - Why: The current transcript is too flat and is hard to scan in long sessions.
  - Files likely involved: `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`, `packages/tui-ink/src/components/parts/TextPart.tsx`.
  - Implementation notes: Keep the current theme system. Do not invent new message containers unless necessary. Prefer typography/color weight and small spacing changes over adding new borders.
  - Acceptance criteria: User messages are easy to spot at a glance, assistant prose reads like the primary content, and tool rows visually recede.
  - Validation: Manual scan of a long transcript with mixed user, assistant, and tool messages at `120x40`.

- [ ] UX change — Invert tool disclosure defaults and simplify tool states
  - Scope: Default completed tools to collapsed, keep running tools as one-line progress summaries, always expand errors, prefer `state.title` for summaries, and reduce kind icons to the reviewed four-icon vocabulary.
  - Why: Tool rows are currently backwards: noisy while running and hidden after completion.
  - Files likely involved: `packages/tui-ink/src/components/parts/ToolPart.tsx`, `packages/tui-ink/src/store.ts`, `packages/tui-ink/test/store.test.ts`, `packages/tui-ink/test/integration.test.ts`.
  - Implementation notes: Replace `borderStyle="round"` with the lighter transcript grammar used elsewhere. Running tools should not stringify raw JSON input by default.
  - Acceptance criteria: Successful tools are collapsed by default, running tools show a concise line only, and errors expand automatically with readable failure detail.
  - Validation: Manual stream of a tool-heavy turn plus regression coverage for collapse toggling and tool lifecycle behavior.

- [ ] UX change — Reduce transcript chrome and separate prose from execution detail
  - Scope: Simplify message padding/nesting, keep tool rows clearly indented under the assistant turn, and make metadata/footers visually tertiary.
  - Why: The current message rows use more container chrome than they need, which adds noise.
  - Files likely involved: `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ReasoningPart.tsx`, `packages/tui-ink/src/components/parts/CompactionPart.tsx`.
  - Implementation notes: This is not a rewrite of the message pipeline. Keep the current part dispatch and focus on reducing visual clutter and clarifying hierarchy.
  - Acceptance criteria: Tool/detail rows feel subordinate to the assistant turn, message footers are visibly metadata, and transcript scanning is calmer than baseline.
  - Validation: Manual comparison against Milestone 0 baseline screenshots or notes.

- [ ] validation — Stop and verify milestone 2
  - Scope: Add or update focused regression coverage for tool collapse behavior and rerun the manual transcript checks before moving to composer work.
  - Why: Milestone 3 will be input-heavy; transcript readability should be locked first.
  - Files likely involved: `packages/tui-ink/test/store.test.ts`, `packages/tui-ink/test/integration.test.ts`, `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`.
  - Implementation notes: Include at least one manual check for collapsed and expanded tool calls, one for a failure case, and one for a streamed assistant turn.
  - Acceptance criteria: Transcript hierarchy is visibly improved, tool rows use progressive disclosure, and tests cover the new collapse defaults.
  - Validation: Run `cd packages/tui-ink && bun typecheck` and the updated test set, then run the transcript-related manual checklist items.

### Risks / regressions to watch
- Tool summary changes can remove useful context if the helper logic is too aggressive; prefer losing noise, not signal.
- Visual hierarchy tweaks can accidentally make assistant text too dim or make message boundaries ambiguous; compare directly with baseline.

### Definition of done
- Transcript scanning clearly distinguishes user input, assistant prose, and execution detail.
- Tool calls default to concise summaries with errors expanded.
- Message chrome is quieter than baseline without losing structural clarity.
- Tool collapse defaults and lifecycle behavior have regression coverage.

### Milestone notes

## Milestone 3 — Composer and bottom dock UX
### Objective
Make prompt entry feel editor-grade and make the dock states predictable, keyboard-discoverable, and safe when permissions or questions interrupt the composer.

### Tasks
- [ ] refactor — Introduce a focused text-input hook with behavior parity first
  - Scope: Extract the raw text-editing state from `Composer.tsx` into a reusable hook without changing visible behavior yet.
  - Why: The composer is already too large, and cursor/multiline changes are risky if they are made inline.
  - Files likely involved: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/hooks/useTextInput.ts`.
  - Implementation notes: Keep this first extraction narrow: value, cursor, insert/delete primitives, and submit/clear helpers. Do not move mention or slash logic yet.
  - Acceptance criteria: The composer still behaves like baseline after the extraction, but editing state no longer lives inline in the render file.
  - Validation: Add focused hook tests if practical, otherwise verify manual parity before proceeding to the next task.

- [ ] UX change — Add cursor-aware editing and readline-style controls
  - Scope: Implement left/right movement, `Ctrl+A`, `Ctrl+E`, `Ctrl+W`, backspace/delete at cursor, and correct caret rendering.
  - Why: The composer is currently append-only, which is the most user-visible defect in the TUI.
  - Files likely involved: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/test`.
  - Implementation notes: Keep server-appended prompt text behavior explicit. If the runtime requires appending server text at the end instead of at the cursor, document that choice in milestone notes.
  - Acceptance criteria: Users can edit in the middle of the prompt and use standard readline-style navigation keys.
  - Validation: Manual checks for typing in the middle of a line, deleting words, moving home/end, and aborting during generation.

- [ ] UX change — Add controlled multi-line input without breaking submit behavior
  - Scope: Support newline insertion with `Alt+Enter` or `Ctrl+J`, keep plain `Enter` as submit, and render the caret correctly for multi-line content.
  - Why: BetterCode needs to accept pasted errors, code snippets, and structured prompts without forcing external editors.
  - Files likely involved: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/components/BottomDock.tsx`.
  - Implementation notes: History navigation should only trigger when the caret is at the logical top or bottom edge of the composed text. Keep the initial layout simple; avoid a dock rewrite.
  - Acceptance criteria: Multi-line prompts can be entered, edited, and submitted intentionally without accidental sends.
  - Validation: Manual paste of multi-line content, newline insertion, and history navigation at both single-line and multi-line states.

- [ ] UX change — Simplify composer metadata and make dock states calmer
  - Scope: Make stash and attachment indicators compact, keep slash/mention overlays readable, and ensure the input row remains the visual focus.
  - Why: Composer metadata currently competes with the cursor and makes the bottom dock feel assembled rather than designed.
  - Files likely involved: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/SlashMenu.tsx`.
  - Implementation notes: Keep metadata in one compact lane when possible. Do not redesign slash or mention behavior beyond what is needed to reduce clutter and preserve discoverability.
  - Acceptance criteria: Attachments, stash, and slash/mention overlays are visible but secondary to the active input line.
  - Validation: Manual checks for plain typing, slash command filtering, file mentions, attachment display, and generation-state composer appearance.

- [ ] UX change — Make permission/question flows and dock focus transitions explicit
  - Scope: Ensure the active input target is obvious when a permission or question prompt is shown, keep dock height changes clamped and predictable, and align status-bar hints with the current prompt surface.
  - Why: Permissions and questions currently compete with the composer for focus and can cause bottom-dock instability.
  - Files likely involved: `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/PermissionPrompt.tsx`, `packages/tui-ink/src/components/QuestionPrompt.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: This task should clarify focus and dock behavior, not redesign the prompt model. If a prompt arrives mid-stream, the focused control and visible hints must still be unambiguous.
  - Acceptance criteria: Permission and question prompts feel like the active surface, keyboard guidance is accurate, and the dock does not become visually confusing when it changes state.
  - Validation: Manual checks for a permission request, a multi-question prompt, prompt rejection, and resizing while a prompt is active.

- [ ] validation — Stop and verify milestone 3
  - Scope: Add package-local regression coverage for the text-input hook and rerun the full composer/dock manual matrix before any structural cleanup begins.
  - Why: This is the riskiest user-facing milestone and should be stable before refactors continue.
  - Files likely involved: `packages/tui-ink/test`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/components/BottomDock.tsx`.
  - Implementation notes: A dedicated test file such as `packages/tui-ink/test/composer.test.ts` or `packages/tui-ink/test/text-input.test.ts` is appropriate if existing files become overloaded.
  - Acceptance criteria: Cursor editing, multi-line input, stash restore, slash/mention overlays, and permission/question flows all pass their checks.
  - Validation: Run `cd packages/tui-ink && bun typecheck`, the updated focused tests, and the composer/dock manual checklist.

### Risks / regressions to watch
- Input handling changes can easily steal arrow keys from the message list or prompts; verify focus ownership carefully.
- Multi-line input can break dock height assumptions and placeholder rendering; stop immediately if the dock becomes unstable.

### Definition of done
- The composer supports cursor movement and standard editing keys.
- Multi-line prompts work without breaking plain-enter submission.
- Composer metadata no longer competes with the input line.
- Permission/question prompts clearly take focus when active.

### Milestone notes

## Milestone 4 — Structural cleanup
### Objective
Reduce ambiguity in component ownership and state access so later performance and maintenance work can be done without broad rewrites.

### Tasks
- [ ] refactor — Add typed UI models and remove `as any` from core session surfaces
  - Scope: Introduce explicit extended types for sessions, messages, text parts, and related UI-only fields, then replace the current `as any` usage in the core transcript/session surfaces.
  - Why: Type casts currently hide real data-shape assumptions and make refactors riskier.
  - Files likely involved: `packages/tui-ink/src/types.ts`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`.
  - Implementation notes: Prioritize the core session path. Do not spend time replacing the `import.meta as any` in `index.tsx` unless this milestone requires touching it.
  - Acceptance criteria: Core session/transcript files no longer rely on `as any` for `parentID`, message timing/metadata, or synthetic/ignored text-part checks.
  - Validation: `rg -n "as any" packages/tui-ink/src` shows only intentionally deferred non-core cases, and `cd packages/tui-ink && bun typecheck` passes.

- [ ] refactor — Introduce session-scoped selector helpers and reduce broad subscriptions
  - Scope: Replace repeated ad hoc `useAppStore` lookups and array-building selectors with narrow, session-scoped selector helpers.
  - Why: Current selectors in `SessionScreen` and `MessageList` are broader and noisier than necessary.
  - Files likely involved: `packages/tui-ink/src/store.ts`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`.
  - Implementation notes: Keep a single store in this milestone. The goal is selector hygiene, not store splitting. Avoid selectors that create new arrays or objects on every update.
  - Acceptance criteria: The session shell and transcript use explicit derived selectors/helpers and no longer build child-session arrays inline inside selectors.
  - Validation: Manual spot-check with streaming active plus `bun test` for store/integration coverage where selector behavior changed.

- [ ] refactor — Split `Composer.tsx` into smaller owned pieces after milestone 3 is stable
  - Scope: Move distinct responsibilities out of `Composer.tsx` so the main file is a thin coordinator over the text-input hook, mention behavior, slash behavior, and view rendering.
  - Why: `Composer.tsx` is currently a 443-line mixed-responsibility surface and will keep regressing if it stays monolithic.
  - Files likely involved: `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/src/hooks/useTextInput.ts`, `packages/tui-ink/src/hooks/useMentions.ts`, `packages/tui-ink/src/hooks/useSlashCommands.ts`, optional small child components under `packages/tui-ink/src/components`.
  - Implementation notes: Keep the extraction incremental. Preparation is complete once responsibilities are separated; do not redesign behavior again in this milestone unless a cleanup is required to preserve Milestone 3 behavior.
  - Acceptance criteria: The main `Composer.tsx` file becomes a thin composition layer and no longer owns all editing, mention, slash, and metadata logic inline.
  - Validation: Re-run the composer tests from Milestone 3 and manual smoke-check the same behaviors after the extraction.

- [ ] cleanup — Remove dead session UI surfaces and settle sidebar ownership
  - Scope: Delete or archive unused session surfaces and stop leaving ambiguous "live but inactive" code in the tree.
  - Why: `InputBar.tsx`, `ChatPane.tsx`, and `ContextPane.tsx` add noise, and `Sidebar` still has unclear ownership in the live session path.
  - Files likely involved: `packages/tui-ink/src/components/InputBar.tsx`, `packages/tui-ink/src/components/ChatPane.tsx`, `packages/tui-ink/src/components/ContextPane.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`, `packages/tui-ink/src/screens/SessionScreen.tsx`.
  - Implementation notes: Prefer deleting dead files if nothing imports them. If sidebar remains, wire its `active` behavior intentionally and remove the `active={false}` hack from `SessionScreen.tsx`.
  - Acceptance criteria: Dead session UI files are no longer part of the live mental model, and sidebar ownership is explicit.
  - Validation: `rg -n "InputBar|ChatPane|ContextPane|active=\\{false\\}" packages/tui-ink/src` should not show stale live references after the cleanup.

- [ ] validation — Stop and verify milestone 4
  - Scope: Re-run core tests, typecheck, and manual session/dialog checks after the cleanup work.
  - Why: This milestone intentionally changes internals; it should not introduce user-visible regressions before performance work begins.
  - Files likely involved: `packages/tui-ink/src/store.ts`, `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/components/Composer.tsx`, `packages/tui-ink/test`.
  - Implementation notes: Record any cleanup-related deviations or deferred type cases in the milestone notes before moving on.
  - Acceptance criteria: The codebase is simpler to reason about, core session surfaces are typed, and the UI still matches Milestone 3 behavior.
  - Validation: Run `cd packages/tui-ink && bun typecheck` and the focused tests, then manually verify session switching, dialogs, sidebar behavior, and composer flows.

### Risks / regressions to watch
- Selector cleanup can accidentally widen subscriptions if the new helpers are not actually narrow; check the implementation, not just the naming.
- Deleting dead files is safe only if imports are gone; verify with `rg` before removing anything.

### Definition of done
- Core session/transcript files no longer depend on `as any`.
- Session-scoped selectors are explicit and narrower than baseline.
- `Composer.tsx` is no longer a monolith.
- Dead session UI surfaces are removed or explicitly settled.

### Milestone notes

## Milestone 5 — Performance and stability
### Objective
Reduce transcript hot-path work, stabilize scroll behavior under streaming and resize, and keep long sessions responsive without changing product behavior.

### Tasks
- [ ] performance — Add a reusable long-session fixture before optimizing the transcript
  - Scope: Create or extract test-only helpers that build long transcript fixtures with mixed user text, assistant prose, tool calls, and streamed parts.
  - Why: Performance work should be measured against repeatable scenarios, not intuition.
  - Files likely involved: `packages/tui-ink/test/scroll.test.ts`, optional `packages/tui-ink/test/fixtures/transcript.ts`, `packages/tui-ink/test/integration.test.ts`.
  - Implementation notes: Keep this test-only unless a tiny debug hook is absolutely necessary. If a debug hook is added, gate it so it does not ship in normal runs.
  - Acceptance criteria: Tests can build representative 100-message and 500-message histories without duplicating fixture code.
  - Validation: Run the relevant tests and record the new fixture entry points in this milestone's notes.

- [ ] performance — Add a height cache for completed messages
  - Scope: Cache estimated message heights so completed messages are not re-lexed and remeasured on every stream flush.
  - Why: `MessageList.tsx` currently recalculates transcript height from all messages on each delta.
  - Files likely involved: `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`, `packages/tui-ink/test/scroll.test.ts`.
  - Implementation notes: Key the cache by message id, width, and a simple version derived from the message's current parts. Invalidate on width changes and on the in-progress message only.
  - Acceptance criteria: Completed messages reuse cached heights while the active streaming message still updates correctly.
  - Validation: Add or update tests around height estimation and manually confirm scrolling still reaches top and bottom correctly.

- [ ] performance — Stabilize part references and memoize transcript rows
  - Scope: Make `useSessionParts` preserve references for unchanged messages and wrap transcript row components in `React.memo` where it actually helps.
  - Why: Memoization is currently defeated by new object references on each delta.
  - Files likely involved: `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`, `packages/tui-ink/src/components/parts/TextPart.tsx`.
  - Implementation notes: Do not add memoization blindly. Fix reference stability first, then memoize row components and confirm the props are stable enough to benefit.
  - Acceptance criteria: Completed transcript rows do not rerender on every streaming delta for an unrelated row in the same session.
  - Validation: Use the fixture from the previous task plus manual streaming observation in a long session.

- [ ] performance — Implement visible-window rendering while preserving current scroll semantics
  - Scope: Render only the visible transcript slice plus a small buffer, and use spacer boxes to keep scroll math correct.
  - Why: Full-list rendering does not scale to long sessions even with height caching.
  - Files likely involved: `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/test/scroll.test.ts`.
  - Implementation notes: Preserve existing sticky-bottom behavior, detached-scroll indicator, `ctrl+down` snap to bottom, mouse-wheel behavior, and saved per-session scroll positions. If any of those break, stop and fix before proceeding.
  - Acceptance criteria: Large histories render only a small visible subset while scroll behavior remains functionally identical to the pre-windowed UI.
  - Validation: Long-history manual checks plus the updated scroll tests.

- [ ] performance — Remove remaining hot-path formatting during streaming
  - Scope: Keep running tool calls and actively streaming text from doing unnecessary heavy formatting work on every delta.
  - Why: Even after windowing, repeated markdown lexing and JSON formatting can still create jitter.
  - Files likely involved: `packages/tui-ink/src/components/MessageList.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`, `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`.
  - Implementation notes: Avoid repeated `JSON.stringify` for running tools. If streaming markdown must be simplified temporarily, keep the simplified mode limited to the active row and restore full rendering on quiet/completion.
  - Acceptance criteria: Streaming remains readable, but expensive formatting work is deferred away from the hot path.
  - Validation: Manual streaming session with long assistant output and several tool calls, plus package-local tests where practical.

- [ ] validation — Stress-test long sessions, streaming, resize, and session switching before milestone 6
  - Scope: Run the full regression matrix with extra focus on long transcripts, terminal resize mid-stream, collapsed/expanded tools, and long-session stability.
  - Why: This milestone changes the hottest path in the UI and needs explicit confidence before polish work.
  - Files likely involved: `packages/tui-ink/test/scroll.test.ts`, `packages/tui-ink/test/integration.test.ts`, `packages/tui-ink/src/components/MessageList.tsx`.
  - Implementation notes: Record before/after observations or counts in this milestone's notes so the performance work is auditable.
  - Acceptance criteria: The transcript stays stable and responsive in long sessions, and no major scroll or streaming regression remains.
  - Validation: Run `cd packages/tui-ink && bun typecheck` and the updated tests, then run the full manual regression checklist.

### Risks / regressions to watch
- Windowed rendering can easily break sticky scrolling, saved scroll positions, and scroll-to-bottom behavior; treat those as blockers, not polish issues.
- Aggressive streaming simplification can make the active assistant turn feel broken; keep the simplified state readable and local to the active row.

### Definition of done
- Height estimation work is cached for completed messages.
- Transcript rows have stable references and meaningful memoization.
- Only visible transcript rows render in long histories.
- Long-session scrolling, streaming, and resizing pass the regression matrix.

### Milestone notes

## Milestone 6 — Production hardening and polish
### Objective
Close the remaining edge-state, resize, keyboard-consistency, and polish gaps so the UI is coherent and resilient across real terminal conditions.

### Tasks
- [ ] validation — Audit the final edge-state matrix before patching polish issues
  - Scope: List remaining gaps for loading/empty/error states, abort flows, reconnect behavior, prompt rejection, narrow terminals, theme picker behavior, and dialog/help consistency.
  - Why: The final polish pass should be driven by an explicit edge-state list, not ad hoc fixes.
  - Files likely involved: `plans/ui-3.0/codex/implementation.md`, `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/components/DialogOverlay.tsx`, `packages/tui-ink/src/components/ThemePickerDialog.tsx`.
  - Implementation notes: Record the audit in this milestone's notes first, then patch the highest-signal gaps only.
  - Acceptance criteria: The notes contain a concrete, finite list of remaining hardening items.
  - Validation: Confirm each listed gap maps to a real file and a specific surface.

- [ ] UX change — Harden empty, loading, error, and interrupt states
  - Scope: Make the home screen, assistant error display, prompt callouts, and overlay states read consistently and include clear recovery guidance.
  - Why: These states currently exist but are uneven and rely too much on localized component behavior.
  - Files likely involved: `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/DialogOverlay.tsx`, `packages/tui-ink/src/components/PermissionPrompt.tsx`, `packages/tui-ink/src/components/QuestionPrompt.tsx`, `packages/tui-ink/src/components/ToastOverlay.tsx`.
  - Implementation notes: Keep callouts compact and text-led. Do not add decorative chrome. Avoid relying on color alone to signal success, warning, or error.
  - Acceptance criteria: Empty/loading/error/interrupted states are readable, compact, and explicit about what the user can do next.
  - Validation: Manual checks for home loading, failed sync, assistant error, aborted run, permission reject, and question reject.

- [ ] UX change — Run a keyboard consistency pass across dialogs, prompts, and help
  - Scope: Align close/confirm/cancel hints, ensure help surfaces reflect the actual keybindings, and resolve stale or conflicting shortcut copy.
  - Why: BetterCode is keyboard-first, and the final polish needs one consistent shortcut story.
  - Files likely involved: `packages/tui-ink/src/app.tsx`, `packages/tui-ink/src/components/HelpDialog.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/components/CommandPalette.tsx`, `packages/tui-ink/src/components/SessionListDialog.tsx`, `packages/tui-ink/src/components/ThemePickerDialog.tsx`, `packages/tui-ink/src/components/ModelPickerDialog.tsx`, `packages/tui-ink/src/components/AgentPickerDialog.tsx`, `packages/tui-ink/src/components/ProviderDialog.tsx`, `packages/tui-ink/src/components/McpDialog.tsx`.
  - Implementation notes: Keep the help text authoritative. If a shortcut is kept despite terminal conflict risk, note that explicitly in milestone notes rather than hiding it.
  - Acceptance criteria: Help text, footer hints, and dialog footers all agree on the active shortcuts and close/confirm behavior.
  - Validation: Manual dialog sweep using only the keyboard and a quick read-through of the help surface after updates.

- [ ] UX change — Harden resize and narrow-width behavior across the live shell
  - Scope: Verify and fix resize behavior for the session shell, home screen, bottom dock, and live dialogs so the UI remains usable at `80x24`, `100x30`, and `120x40`.
  - Why: Several surfaces currently assume more space than a real terminal reliably provides.
  - Files likely involved: `packages/tui-ink/src/screens/SessionScreen.tsx`, `packages/tui-ink/src/screens/HomeScreen.tsx`, `packages/tui-ink/src/components/BottomDock.tsx`, `packages/tui-ink/src/components/Sidebar.tsx`, `packages/tui-ink/src/components/CommandPalette.tsx`, `packages/tui-ink/src/components/SessionListDialog.tsx`.
  - Implementation notes: Keep the behavior simple: clamp widths, hide optional surfaces, and preserve the primary interaction target. Do not begin a new layout system in this milestone.
  - Acceptance criteria: The app remains readable and navigable in the target terminal sizes with no overlapping or truncated critical surfaces.
  - Validation: Manual resize checks while idle, while streaming, and while a dock dialog is open.

- [ ] cleanup — Finalize theme preview and border/token consistency
  - Scope: Keep theme preview local until confirm and make sure the final UI uses one border grammar and one set of semantic weight rules.
  - Why: Theme preview currently causes global churn, and the polish pass should end with consistent visual rules.
  - Files likely involved: `packages/tui-ink/src/components/ThemePickerDialog.tsx`, `packages/tui-ink/src/components/Header.tsx`, `packages/tui-ink/src/components/StatusBar.tsx`, `packages/tui-ink/src/components/UserMessage.tsx`, `packages/tui-ink/src/components/AssistantMessage.tsx`, `packages/tui-ink/src/components/parts/ToolPart.tsx`.
  - Implementation notes: This is a cleanup pass, not a restyle. Keep the semantic choices made in earlier milestones and remove any remaining one-off border or preview behavior that fights them.
  - Acceptance criteria: Theme browsing no longer causes immediate global commits, and the shell/transcript share one consistent visual grammar.
  - Validation: Manual theme picker check plus a quick visual sweep of the main shell and transcript.

- [ ] validation — Final release-candidate sweep
  - Scope: Run the full automated and manual checklist one last time and record the final outcome in this milestone's notes.
  - Why: This milestone is only done when the UI is stable enough to hand back for review without hidden regressions.
  - Files likely involved: `packages/tui-ink/test`, `packages/tui-ink/src`, `plans/ui-3.0/codex/implementation.md`.
  - Implementation notes: Record final pass/fail status, any known gaps, and what was deliberately deferred. Do not silently carry issues into the next review.
  - Acceptance criteria: The full regression matrix passes or every remaining failure is explicitly documented as deferred/blocking.
  - Validation: Run `cd packages/tui-ink && bun typecheck`, the focused tests added across milestones, and the complete manual matrix from Milestone 0.

### Risks / regressions to watch
- Final polish can accidentally reopen behavior that earlier milestones stabilized; treat any reopened regression as a stop issue.
- Help/shortcut copy can drift from actual behavior unless it is updated alongside implementation changes in the same task.

### Definition of done
- Edge states are compact, readable, and actionable.
- Keyboard help and dialog footers match actual shortcuts.
- The UI remains usable under resize and narrow-width conditions.
- Final automated and manual regression sweeps are recorded and acceptable.

### Milestone notes

## Open questions / deferred items
- Transcript search and jump navigation are useful, but they should stay deferred until the core transcript and composer work above is stable.
- Grouping consecutive tool calls into a higher-level summary is deferred unless Milestone 2 still leaves tool-heavy turns too noisy.
- Store splitting into `useStreamStore`, `useAppStore`, and `useUIStore` is deferred unless Milestone 5 measurements show selector cleanup is still insufficient.
- Shared dialog primitives for all pickers are deferred; do not start this work unless the current milestone explicitly calls for it.
- A dedicated diff/log viewer for expanded tool output is deferred; the current scope only needs cleaner inline summaries and sensible expansion behavior.

## Execution rules for OpenCode
- Implement one milestone at a time and do not start the next milestone until the current one is stable enough and fully revalidated.
- Update TODO statuses continuously in this file while working. There should be at most one `[~]` task in the active milestone.
- Keep each milestone's notes current with decisions, blockers, regressions, and any deviation from the planned scope or sequence.
- Prefer small, reviewable changes over large rewrites. If a milestone feels too large, split the work across more commits, not broader tasks.
- Do not invent architecture beyond what is written here. If a task requires a structural choice that is not explicit, stop, note the decision point in milestone notes, and take the smallest safe option.
- When a task depends on another task, complete and verify the dependency first rather than partially overlapping the work.
- Keep UX changes and refactors separate whenever possible. Do not hide behavior changes inside cleanup-only tasks.
- Use package-local commands for validation. Do not run tests from repo root. Prefer `cd packages/tui-ink && bun typecheck` and focused `bun test` invocations.
- After each milestone, run the milestone acceptance checks and the reusable regression checklist before moving on.
- If a regression appears in streaming, scrolling, tool collapse, keyboard handling, terminal resize, sidebar/dialog interaction, or long-session stability, stop and fix it before continuing.
