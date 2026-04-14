# BetterCode Project Rules

This file mirrors the project guidance in `AGENTS.md` for Claude-compatible agents. If both files are available, keep them aligned. The project-specific instructions below are the ones future sessions are most likely to need.

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- Always use parallel tools when applicable.
- The default branch in this repo is `dev`.
- Local `main` may not exist. Use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## BetterCode UI 3.0

- When the task touches `packages/tui-ink` UI/UX/performance work or references `plans/ui-3.0`, read these files first:
  - `plans/ui-3.0/implementation.md`
  - `plans/ui-3.0/codex/implementation-review.md`
  - `plans/ui-3.0/codex/final-codex-review.md`
- Treat OpenCode like a junior engineer:
  - implement one milestone at a time
  - keep `plans/ui-3.0/implementation.md` updated while working
  - do not skip validation gates
  - do not begin the next milestone until the current one is stable
- Prefer the project-local implementation skill when available:
  - `.opencode/skills/bettercode-ui-implementation/SKILL.md`
- Main TUI hot-path files:
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
- Regressions to guard on every UI 3.0 milestone:
  - streaming sessions
  - sticky scroll and detached scroll
  - collapsed/expanded tool calls
  - keyboard shortcuts and focus ownership
  - permission/question flows
  - terminal resize while idle and while streaming
  - session switching and per-session scroll state
  - long transcripts
- For UI 3.0 work, validate from `packages/tui-ink` with:
  - `bun typecheck`
  - `bun test test/`
- Do not run tests from repo root.
- Prefer small milestone-sized changes over large rewrites.
- For performance work, keep scroll and render correctness ahead of optimization.
- For composer work, preserve slash commands, mentions, history, stash, abort, and prompt flows while improving editing behavior.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (`flatMap`, `filter`, `map`) over `for` loops; use type guards on `filter` to preserve type inference downstream

### Naming

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.

### Destructuring

- Avoid unnecessary destructuring. Prefer dot notation to preserve context.

### Variables

- Prefer `const` over `let`.
- Use ternaries or early returns instead of reassignment.

### Control Flow

- Avoid `else` statements when an early return is clearer.

## Testing

- Avoid mocks as much as possible.
- Test actual implementation, do not duplicate logic into tests.
- Tests cannot run from repo root; run from package directories like `packages/opencode` or `packages/tui-ink`.

## Type Checking

- Always run `bun typecheck` from the relevant package directory.
- Never run `tsc` directly.
