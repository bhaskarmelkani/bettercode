# bettercode TUI - Checklist Plan

**Stack:** Bun · Ink v5 · React · Zustand · official Ink ecosystem packages  
**Package:** `packages/tui-ink/`

## Rules

- Use only `ink` and official Ink ecosystem packages such as `ink-text-input`, `ink-select-input`, and `ink-spinner`.
- Do not introduce custom UI libraries, custom terminal renderers, or bespoke component frameworks.
- Compose screens from Ink primitives and small local glue only when unavoidable.
- Keep the implementation keyboard-first.
- Keep state normalized and predictable.
- Update the todo list after each completed task so the next session can resume cleanly.

## Outcome

The fork is ready when:

- It boots reliably on Bun.
- It can handle the same core session workflow as the current opencode TUI.
- It can manage providers, models, agents, sessions, MCP, permissions, questions, and themes.
- It exposes the most important host commands and plugin routes.
- It has a clear manual-test checklist and a maintained todo trail.

## Session Workflow

Each milestone should be implemented in a fresh opencode session.

For every new session:

- Read this plan first.
- Read the current todo list before making changes.
- Implement only one milestone in that session unless the milestone is trivially small.
- Mark completed items in the todo list before ending the session.
- Add a short note describing what was completed and what remains.

## Milestone 0 - Compatibility Spike

Goal: prove the rewrite can talk to the real server.

Checklist:

- [x] Wire a typed SDK client wrapper in `packages/tui-ink/src/hooks/useSDK.ts`.
- [x] Load the client with `url`, `directory`, and auth headers from the entrypoint.
- [x] Subscribe to the global event stream.
- [x] Retry the stream with backoff when it drops.
- [x] Bootstrap providers, sessions, commands, agents, MCP, LSP, VCS, and config.
- [x] Add a typed dispatcher for the event payloads we actually use.
- [x] Confirm the app loads from a live server without crashing.

Done when:

- [x] Providers are visible.
- [x] Sessions are visible.
- [x] Session status updates appear in store state.

## Milestone 1 - App Shell And Routing

Goal: make the app usable before deep feature work starts.

Checklist:

- [x] Replace the flat shell with a screen router.
- [x] Add a home screen for the initial prompt.
- [x] Add a session screen for active conversation work.
- [x] Add dialog overlay support.
- [x] Add global key handling for exit, session switching, command palette, and dialog close.
- [x] Add loading, empty, and error states.
- [x] Make terminal resizing work correctly.

Done when:

- [x] Fresh startup lands on home.
- [x] Opening a session lands on the session screen.
- [x] Global shortcuts work without breaking input.

## Milestone 2 - Composer And Streaming Chat

Goal: make the core chat loop production-ready.

Checklist:

- [x] Implement the composer with plain text input.
- [x] Support submit, clear, and history recall.
- [x] Support slash detection and autocomplete.
- [x] Render streamed assistant output incrementally.
- [x] Render text parts.
- [x] Render reasoning parts, hidden by default.
- [x] Render file, subtask, tool, retry, snapshot, patch, agent, and compaction parts.
- [x] Render tool states for pending, running, completed, and error.
- [x] Add permission prompts above the composer.
- [x] Add question prompts above the composer.
- [x] Add sticky scroll and manual scroll state.

Done when:

- [x] A long response can be read to the end.
- [x] Tool state transitions are visible.
- [x] Permission and question prompts can be answered by keyboard.

## Milestone 3 - Command System

Goal: replace hidden hotkeys with discoverable commands.

Checklist:

- [x] Implement a command registry.
- [x] Register host commands for session, model, agent, provider, MCP, theme, help, and exit.
- [x] Add a command palette opened with `Ctrl+K`.
- [x] Add slash autocomplete for supported commands.
- [x] Allow the server to publish command execution events into the UI.
- [x] Show command keybinds and categories in the palette.

Done when:

- [x] Commands can be launched from the palette.
- [x] Slash completion works in the composer.
- [x] Command entries show their bindings.

## Milestone 4 - Session Management

Goal: make navigation across sessions first-class.

Checklist:

- [x] Add a session list dialog.
- [x] Filter to root sessions by default.
- [x] Sort sessions by updated time.
- [x] Add create session.
- [x] Add select session.
- [x] Add rename session.
- [x] Add delete session with confirmation.
- [x] Add fork session.
- [x] Add share session.
- [x] Add summarize session.
- [x] Add abort session.
- [x] Add revert session.
- [x] Fetch messages lazily when a session becomes active.
- [x] Preserve scroll state per session.
- [x] Show child sessions and subtask links.

Done when:

- [x] Users can switch sessions quickly.
- [x] Forked child sessions can be opened from the parent thread.
- [x] Share and export produce visible feedback.

## Milestone 5 - Providers, Models, Agents, MCP

Goal: make runtime configuration available from the TUI.

Checklist:

- [x] Build provider auth flows for API-key providers.
- [x] Build provider auth flows for OAuth providers.
- [x] Show provider availability and default model data.
- [x] Build a model picker with recent and favorite models.
- [x] Build an agent picker with agent metadata.
- [x] Build an MCP status view.
- [x] Support MCP connect.
- [x] Support MCP disconnect.
- [x] Refresh provider and MCP state after auth changes.

SDK notes:

- `provider.auth()` returns a map keyed by provider ID.
- OAuth auth returns `method`, `url`, and `instructions`.
- `permission.reply()` is the permission response API.
- `question.reply()` sends arrays of string answers.

Done when:

- [x] A user can connect a provider from the TUI.
- [x] A user can switch models without restarting.
- [x] MCP state updates after connect and disconnect.

## Milestone 6 - Context, Sidebar, Themes

Goal: make the UI feel complete and fast to use.

Checklist:

- [x] Add file search for `@` mentions.
- [x] Insert attached files into prompts.
- [x] Add sidebar sections for diff, todos, LSP, MCP, and workspace state.
- [x] Add theme selection.
- [x] Persist theme selection.
- [x] Add toast rendering.
- [x] Add toast queue management.
- [x] Add help dialog.
- [x] Add confirm, prompt, and alert dialogs.

Done when:

- [x] File attachment works from the composer.
- [x] Theme changes are visible immediately.
- [x] Toasts appear without blocking input.

## Milestone 7 - Host Parity And Plugins

Goal: close the gap with the current opencode TUI.

Checklist:

- [x] Add plugin route support.
- [x] Add plugin command registration.
- [x] Add host slots for home and session customization.
- [x] Add prompt history (persisted across sessions via prefs).
- [x] Add prompt stash (Ctrl+X to stash, Ctrl+Y to restore).
- [ ] Add frecency if the current workflow depends on it.
- [x] Decide whether worktrees are required for v1. **Decision: deferred. No worktree-specific UX needed; directory prop covers the common case.**
- [x] Decide whether console org switching is required for v1. **Decision: deferred. No org switching in TUI; punt to v2.**
- [x] Decide whether PTY is required for v1. **Decision: deferred. Core chat UX takes priority; PTY blocked on Ink v5 pty integration.**

Recommendation:

- [x] Ship plugin routes and command registration.
- [x] Ship prompt history and stash (part of daily workflow).
- [x] Defer PTY until the core chat UX is stable.

## Engineering Checklist

Before any milestone begins:

- [ ] Read this plan.
- [ ] Read the current todo list.
- [ ] Confirm the milestone scope for this session.

During implementation:

- [ ] Keep changes inside the milestone boundary.
- [ ] Prefer small, testable edits.
- [ ] Avoid introducing custom UI abstractions.
- [ ] Use Ink primitives and official Ink ecosystem components.

Before ending the session:

- [ ] Update the todo list with completed items.
- [ ] Note any partially completed work.
- [ ] Record the next logical subtask.
- [ ] Confirm the next session can continue without rereading the whole codebase.

## Testing Plan

Add tests as each milestone lands:

- [ ] Store reducer tests for session, message, and part updates.
- [ ] Event dispatch tests for global sync events.
- [ ] Composer tests for submit, slash handling, and mention insertion.
- [ ] Session navigation tests.
- [ ] Provider auth flow tests.
- [ ] Keyboard shortcut tests.
- [ ] Snapshot or golden tests for message renderers.

Manual acceptance checklist:

- [ ] Cold start with no providers.
- [ ] Connect provider and load models.
- [ ] Send a prompt and watch streaming output.
- [ ] Trigger permission and question prompts.
- [ ] Switch sessions.
- [ ] Toggle MCP.
- [ ] Scroll through a long response.
- [ ] Change theme.
- [ ] Export and share a session.
- [ ] Open a plugin route if plugins are in scope.

## Release Bar

Do not publish the fork until these are true:

- [ ] No runtime crashes on startup with a real server.
- [ ] New prompts stream correctly.
- [ ] Permissions and questions can be handled.
- [ ] Provider, model, and session switching works.
- [ ] Export, share, and revert do not lose data.
- [ ] Keyboard navigation works on macOS and Linux.
- [ ] There is a documented fallback path for unsupported enterprise or PTY features.

## Suggested Implementation Order

- [x] Milestone 0
- [x] Milestone 1
- [x] Milestone 2
- [x] Milestone 3
- [x] Milestone 4
- [x] Milestone 5
- [x] Milestone 6
- [x] Milestone 7

## Reference Files

Read these first while implementing:

| File                                                                  | Why it matters                             |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `packages/opencode/src/cli/cmd/tui/context/sync.tsx`                  | Baseline sync behavior and event handling  |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`          | Message rendering and tool mapping         |
| `packages/opencode/src/cli/cmd/tui/routes/home.tsx`                   | Startup flow and initial prompt behavior   |
| `packages/opencode/src/cli/cmd/tui/component/dialog-provider.tsx`     | Provider auth flow                         |
| `packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`      | Command registration pattern               |
| `packages/opencode/src/cli/cmd/tui/component/dialog-session-list.tsx` | Session list behavior                      |
| `packages/opencode/src/cli/cmd/tui/context/keybind.tsx`               | Keybind parsing and matching               |
| `packages/sdk/js/src/v2/gen/sdk.gen.ts`                               | Exact method signatures for every SDK call |
| `packages/sdk/js/src/v2/gen/types.gen.ts`                             | Event and payload shapes                   |
| `packages/opencode/specs/tui-plugins.md`                              | Plugin parity requirements                 |
| `packages/tui-ink/src/hooks/useSDK.ts`                                | Existing SSE loop to extend                |
