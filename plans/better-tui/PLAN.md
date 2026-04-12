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

- [ ] Wire a typed SDK client wrapper in `packages/tui-ink/src/hooks/useSDK.ts`.
- [ ] Load the client with `url`, `directory`, and auth headers from the entrypoint.
- [ ] Subscribe to the global event stream.
- [ ] Retry the stream with backoff when it drops.
- [ ] Bootstrap providers, sessions, commands, agents, MCP, LSP, VCS, and config.
- [ ] Add a typed dispatcher for the event payloads we actually use.
- [ ] Confirm the app loads from a live server without crashing.

Done when:

- [ ] Providers are visible.
- [ ] Sessions are visible.
- [ ] Session status updates appear in store state.

## Milestone 1 - App Shell And Routing

Goal: make the app usable before deep feature work starts.

Checklist:

- [ ] Replace the flat shell with a screen router.
- [ ] Add a home screen for the initial prompt.
- [ ] Add a session screen for active conversation work.
- [ ] Add dialog overlay support.
- [ ] Add global key handling for exit, session switching, command palette, and dialog close.
- [ ] Add loading, empty, and error states.
- [ ] Make terminal resizing work correctly.

Done when:

- [ ] Fresh startup lands on home.
- [ ] Opening a session lands on the session screen.
- [ ] Global shortcuts work without breaking input.

## Milestone 2 - Composer And Streaming Chat

Goal: make the core chat loop production-ready.

Checklist:

- [ ] Implement the composer with plain text input.
- [ ] Support submit, clear, and history recall.
- [ ] Support slash detection and autocomplete.
- [ ] Render streamed assistant output incrementally.
- [ ] Render text parts.
- [ ] Render reasoning parts, hidden by default.
- [ ] Render file, subtask, tool, retry, snapshot, patch, agent, and compaction parts.
- [ ] Render tool states for pending, running, completed, and error.
- [ ] Add permission prompts above the composer.
- [ ] Add question prompts above the composer.
- [ ] Add sticky scroll and manual scroll state.

Done when:

- [ ] A long response can be read to the end.
- [ ] Tool state transitions are visible.
- [ ] Permission and question prompts can be answered by keyboard.

## Milestone 3 - Command System

Goal: replace hidden hotkeys with discoverable commands.

Checklist:

- [ ] Implement a command registry.
- [ ] Register host commands for session, model, agent, provider, MCP, theme, help, and exit.
- [ ] Add a command palette opened with `Ctrl+K`.
- [ ] Add slash autocomplete for supported commands.
- [ ] Allow the server to publish command execution events into the UI.
- [ ] Show command keybinds and categories in the palette.

Done when:

- [ ] Commands can be launched from the palette.
- [ ] Slash completion works in the composer.
- [ ] Command entries show their bindings.

## Milestone 4 - Session Management

Goal: make navigation across sessions first-class.

Checklist:

- [ ] Add a session list dialog.
- [ ] Filter to root sessions by default.
- [ ] Sort sessions by updated time.
- [ ] Add create session.
- [ ] Add select session.
- [ ] Add rename session.
- [ ] Add delete session with confirmation.
- [ ] Add fork session.
- [ ] Add share session.
- [ ] Add summarize session.
- [ ] Add abort session.
- [ ] Add revert session.
- [ ] Fetch messages lazily when a session becomes active.
- [ ] Preserve scroll state per session.
- [ ] Show child sessions and subtask links.

Done when:

- [ ] Users can switch sessions quickly.
- [ ] Forked child sessions can be opened from the parent thread.
- [ ] Share and export produce visible feedback.

## Milestone 5 - Providers, Models, Agents, MCP

Goal: make runtime configuration available from the TUI.

Checklist:

- [ ] Build provider auth flows for API-key providers.
- [ ] Build provider auth flows for OAuth providers.
- [ ] Show provider availability and default model data.
- [ ] Build a model picker with recent and favorite models.
- [ ] Build an agent picker with agent metadata.
- [ ] Build an MCP status view.
- [ ] Support MCP connect.
- [ ] Support MCP disconnect.
- [ ] Refresh provider and MCP state after auth changes.

SDK notes:

- `provider.auth()` returns a map keyed by provider ID.
- OAuth auth returns `method`, `url`, and `instructions`.
- `permission.reply()` is the permission response API.
- `question.reply()` sends arrays of string answers.

Done when:

- [ ] A user can connect a provider from the TUI.
- [ ] A user can switch models without restarting.
- [ ] MCP state updates after connect and disconnect.

## Milestone 6 - Context, Sidebar, Themes

Goal: make the UI feel complete and fast to use.

Checklist:

- [ ] Add file search for `@` mentions.
- [ ] Insert attached files into prompts.
- [ ] Add sidebar sections for diff, todos, LSP, MCP, and workspace state.
- [ ] Add theme selection.
- [ ] Persist theme selection.
- [ ] Add toast rendering.
- [ ] Add toast queue management.
- [ ] Add help dialog.
- [ ] Add confirm, prompt, and alert dialogs.

Done when:

- [ ] File attachment works from the composer.
- [ ] Theme changes are visible immediately.
- [ ] Toasts appear without blocking input.

## Milestone 7 - Host Parity And Plugins

Goal: close the gap with the current opencode TUI.

Checklist:

- [ ] Add plugin route support.
- [ ] Add plugin command registration.
- [ ] Add host slots for home and session customization.
- [ ] Add prompt history if the current workflow depends on it.
- [ ] Add prompt stash if the current workflow depends on it.
- [ ] Add frecency if the current workflow depends on it.
- [ ] Decide whether worktrees are required for v1.
- [ ] Decide whether console org switching is required for v1.
- [ ] Decide whether PTY is required for v1.

Recommendation:

- [ ] Ship plugin routes and command registration.
- [ ] Ship prompt history and stash if they are part of the daily workflow.
- [ ] Defer PTY until the core chat UX is stable.

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

- [ ] Milestone 0
- [ ] Milestone 1
- [ ] Milestone 2
- [ ] Milestone 3
- [ ] Milestone 4
- [ ] Milestone 5
- [ ] Milestone 6
- [ ] Milestone 7

## Reference Files

Read these first while implementing:

| File | Why it matters |
|---|---|
| `packages/opencode/src/cli/cmd/tui/context/sync.tsx` | Baseline sync behavior and event handling |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` | Message rendering and tool mapping |
| `packages/opencode/src/cli/cmd/tui/routes/home.tsx` | Startup flow and initial prompt behavior |
| `packages/opencode/src/cli/cmd/tui/component/dialog-provider.tsx` | Provider auth flow |
| `packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx` | Command registration pattern |
| `packages/opencode/src/cli/cmd/tui/component/dialog-session-list.tsx` | Session list behavior |
| `packages/opencode/src/cli/cmd/tui/context/keybind.tsx` | Keybind parsing and matching |
| `packages/sdk/js/src/v2/gen/sdk.gen.ts` | Exact method signatures for every SDK call |
| `packages/sdk/js/src/v2/gen/types.gen.ts` | Event and payload shapes |
| `packages/opencode/specs/tui-plugins.md` | Plugin parity requirements |
| `packages/tui-ink/src/hooks/useSDK.ts` | Existing SSE loop to extend |
