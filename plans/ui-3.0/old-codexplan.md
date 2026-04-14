# BetterCode UI 3.0 Execution Plan

This plan turns the BetterCode TUI into a calmer, faster, production-class terminal coding surface while keeping the OpenCode backend intact.

The priorities are:
- transcript first
- tool detail on demand
- a premium, quiet composer
- consistent keyboard grammar
- visible performance improvements for long sessions

## Milestone 0: Shell Contract and Hierarchy

### Goal
Establish the shell architecture before changing visual polish so every later UI change fits a stable frame.

### Target component architecture
- `AppShell` owns terminal size, route selection, global shortcuts, and overlay stacking.
- `TopChrome` owns project, branch, session count, model, agent, and session state.
- `MainStage` owns the transcript and optional right-rail context.
- `DockHost` owns the composer, permission prompts, question prompts, and bottom panels.
- `OverlayHost` owns destructive dialogs, help, alerts, and modal pickers.
- `Panel`, `Chip`, `HintLine`, `FilterList`, `EmptyState`, and `DetailExpander` should become shared primitives.

### Files/components to touch first
- `packages/tui-ink/src/app.tsx`
- `packages/tui-ink/src/screens/SessionScreen.tsx`
- `packages/tui-ink/src/components/Header.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`

### Implementation notes
- Keep the stable root tree pattern that avoids flicker.
- Move composition logic out of `SessionScreen` into shell primitives.
- Make shell responsibility boundaries explicit before refactoring renderers.

### Acceptance criteria
- Route switching and modal overlays do not remount the screen.
- The shell reads as one system instead of several stacked widgets.
- Top and bottom chrome use one shared status vocabulary.

### Risks
- Over-abstracting the shell too early could make later transcript work harder.
- A sloppy refactor here could reintroduce terminal flicker.

---

## Milestone 1: Transcript Calmness and Tool Detail

### Goal
Make the main transcript area feel calm, readable, and scalable for long sessions.

### Exact UX changes for the top message area
- User messages stay minimal: a left rail, a label, markdown body, and file chips.
- Assistant messages show a compact summary line first.
- Tool calls collapse by default when completed.
- Tool details and raw output move behind a caret or expand action.
- Reasoning blocks stay hidden by default and only appear when the user opts in.
- The transcript should clearly indicate when the user is detached from live bottom-follow mode.

### Files/components to touch first
- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/components/AssistantMessage.tsx`
- `packages/tui-ink/src/components/UserMessage.tsx`
- `packages/tui-ink/src/components/parts/ToolPart.tsx`
- `packages/tui-ink/src/components/parts/TextPart.tsx`
- `packages/tui-ink/src/components/parts/ReasoningPart.tsx`
- `packages/tui-ink/src/components/parts/CompactionPart.tsx`
- `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`
- `packages/tui-ink/src/components/markdown/CodeBlock.tsx`

### Implementation notes
- Split rendering into row-level components.
- Keep summary rendering separate from raw details.
- Reduce the amount of border-heavy framing around plain prose.
- Preserve per-session scroll position and sticky-bottom behavior.

### Sample text mockup
```text
bettercode · repo-name · branch-name · 12 sessions              plan · sonnet · ready
────────────────────────────────────────────────────────────────────────────────────
You    update the parser to accept nested lists

AI     found the failing path and patched the lexer
       ▸ bash npm test                      38ms   ok
       ▸ read src/parser.ts                12 lines
       ▸ edit src/parser.ts                 1 file
       ▸ thinking hidden (press t)

↑ detached · ctrl+↓ return live
```

### Acceptance criteria
- Completed tools are scannable in long sessions.
- Tool raw output is still accessible, but not dominant.
- Transcript scrolling stays stable while streaming.

### Risks
- Collapsing too aggressively could hide debugging context.
- Row refactors could accidentally break markdown wrapping or scroll math.

---

## Milestone 2: Composer and Dock Premium Pass

### Goal
Make the bottom composer feel quieter, more efficient, and more obviously active.

### Exact UX changes for the bottom composer
- The prompt line becomes the dominant element.
- Attachments, prompt stash, and helper hints become compact chips or a smaller metadata line.
- Slash suggestions and mention search float as overlays instead of expanding the dock vertically.
- Generating state becomes a status mode with a clear abort hint.
- Permission prompts and question prompts use the same dock frame and action grammar.
- The dock should feel stable across all states, not like a different UI every time the mode changes.

### Files/components to touch first
- `packages/tui-ink/src/components/Composer.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`
- `packages/tui-ink/src/components/SlashMenu.tsx`
- `packages/tui-ink/src/components/PermissionPrompt.tsx`
- `packages/tui-ink/src/components/QuestionPrompt.tsx`
- `packages/tui-ink/src/components/ToastOverlay.tsx`

### Implementation notes
- Reduce composer responsibilities by splitting prompt input, helper chips, and suggestion overlays.
- Keep generation, editing, and prompt-collection states visually distinct.
- Make the composer height and suggestion behavior responsive to narrow terminals.

### Sample text mockup
```text
────────────────────────────────────────────────────────────────────────────────────
› add validation and tests  _
[plan] [@src/parser.ts] [2 files]      ctrl+k commands · / slash · @ files · ctrl+c abort
```

### Acceptance criteria
- The prompt is always the visual focal point in the dock.
- Helper state is available but not visually noisy.
- Permission and question prompts feel like one family.

### Risks
- The composer can become too minimal and hide useful affordances.
- Overlay suggestions can jitter if they are not positioned carefully.

---

## Milestone 3: Shared Dialog System and Discoverability

### Goal
Unify the many list-style dialogs so keyboard discovery becomes consistent across the app.

### Files/components to touch first
- `packages/tui-ink/src/components/CommandPalette.tsx`
- `packages/tui-ink/src/components/SessionListDialog.tsx`
- `packages/tui-ink/src/components/ModelPickerDialog.tsx`
- `packages/tui-ink/src/components/AgentPickerDialog.tsx`
- `packages/tui-ink/src/components/McpDialog.tsx`
- `packages/tui-ink/src/components/ThemePickerDialog.tsx`
- `packages/tui-ink/src/components/HelpDialog.tsx`
- `packages/tui-ink/src/components/DialogOverlay.tsx`
- `packages/tui-ink/src/commands/useHostCommands.ts`

### Implementation notes
- Extract one shared searchable list frame.
- Make the command registry the source of truth for help, palette, and footer hints.
- Keep destructive flows explicit and separate from normal navigation flows.
- Standardize `esc`, `enter`, arrow keys, and filter input behavior across pickers.

### Acceptance criteria
- Every picker looks and behaves like part of the same product.
- Help text and command palette stay in sync with the actual shortcuts.
- New commands automatically appear in the shared help surface.

### Risks
- Shared dialog abstractions can hide feature-specific needs if they are too generic.
- Keyboard behavior regressions are likely unless every dialog is tested after the refactor.

---

## Milestone 4: State and Performance Hardening

### Goal
Keep BetterCode fast and predictable as transcripts grow.

### Files/components to touch first
- `packages/tui-ink/src/store.ts`
- `packages/tui-ink/src/hooks/useSDK.ts`
- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/components/parts/ToolPart.tsx`
- `packages/tui-ink/test/scroll.test.ts`
- `packages/tui-ink/test/integration.test.ts`

### Implementation notes
- Add narrow selectors and derived view models.
- Add reverse indexes for frequent lookups instead of scanning all parts.
- Promote visible-slice or virtualization logic into production.
- Keep markdown and output formatting off the hottest render path when possible.

### Acceptance criteria
- Long transcripts remain responsive.
- Delta streaming stays batched and smooth.
- Store changes do not trigger unnecessary full-screen rerenders.

### Risks
- Virtualization can break bottom-stick logic if not tested carefully.
- Narrow selectors can cause stale UI if derived state is not memoized correctly.

---

## Milestone 5: Cleanup, Polish, and Regression Protection

### Goal
Remove drift, tighten the visual grammar, and lock in the new behavior.

### Files/components to touch first
- `packages/tui-ink/src/components/InputBar.tsx`
- `packages/tui-ink/src/components/ChatPane.tsx`
- `packages/tui-ink/src/components/ContextPane.tsx`
- `packages/tui-ink/src/theme.ts`
- `packages/tui-ink/src/theme-context.tsx`
- `packages/tui-ink/src/screens/HomeScreen.tsx`

### Implementation notes
- Archive or remove dead UI surfaces from the active mental model.
- Tighten the theme token set so color means state, not decoration.
- Make narrow-terminal fallbacks explicit.
- Add tests or snapshot-style checks for the new shell and dialog grammar.

### Acceptance criteria
- The live component tree is smaller and easier to understand.
- Theme and border usage feel more disciplined.
- Small terminals still feel intentional.

### Risks
- Cleanup can accidentally remove something still referenced by a hidden path.
- Visual token changes can affect many components at once.

---

## Visual Hierarchy System

### Layer 0: shell identity
- Project, branch, session count, model, and agent state.
- Always present.
- Lowest visual weight.

### Layer 1: transcript
- Main working area.
- Plain text should stay quiet.
- Borders are for inspectable detail, not ordinary conversation.

### Layer 2: active work
- Composer, prompts, confirmations, and interactive helpers.
- One clear accent and one clear focus marker.

### Layer 3: details on demand
- Tool raw output, logs, diffs, expanded reasoning, and long metadata.
- Hidden by default.

### Layer 4: overlays
- Help, command palette, pickers, alerts, and destructive dialogs.
- Suspend the rest of the shell cleanly.

### Hierarchy rules
- One border per region is usually enough.
- Reserve strong color for active or dangerous state.
- Never let chrome outshine the current task.
- Collapse optional context before shrinking the transcript.

---

## Risks and Regressions to Watch For

- Transcript virtualization may break bottom-stick behavior if scroll math is off.
- Tool collapsing may hide useful debug data if the default summary is too terse.
- Composer simplification may accidentally remove stash, attachment, or mention affordances.
- Shared dialog primitives may create keyboard regressions if each screen is not covered.
- Narrow-terminal behavior may hide too much context if collapse thresholds are too aggressive.
- Store refactors may cause stale renders if selectors are too broad or too narrow.
- Theme preview changes may create flicker if preview state is committed globally too often.

---

## PR-Sized Chunking Strategy

### PR 1
- Shell contract and `SessionScreen` extraction.
- Top and bottom chrome unification.

### PR 2
- Transcript row refactor.
- Tool summary and detail split.

### PR 3
- Composer and dock simplification.
- Permission and question prompt alignment.

### PR 4
- Shared dialog frame and command/help unification.

### PR 5
- Store selector hardening and reverse indexes.
- Visible-slice or virtualization work.

### PR 6
- Cleanup of dead surfaces.
- Theme grammar tightening.
- Performance/regression tests.

---

## Coding Guidelines for BetterCode TUI Contributors

- Keep the transcript render path cheap.
- Use shared primitives instead of inventing one-off frames.
- Prefer local state for cursor, query, preview, and selection when possible.
- Keep global store subscriptions narrow.
- Do not add a new dialog without updating the shared keyboard vocabulary.
- Keep borders and bright colors for active or inspectable state only.
- Avoid `any` in new TUI code unless there is a very short-lived bridge.
- Prefer early returns and small helpers.
- Keep helper names short unless a longer name prevents confusion.
- Update tests when changing scroll math, collapse behavior, or dialog interaction.
- Verify narrow-terminal behavior before merging shell changes.

---

## Definition of Done

- BetterCode feels calm instead of crowded.
- Tool calls are inspectable without being noisy.
- The bottom composer feels premium and stable.
- Long sessions stay fast and readable.
- Keyboard help is coherent across the whole app.
- The shell feels production-class, not prototype-like.
