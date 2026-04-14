---
name: bettercode-ui-implementation
description: Execute the BetterCode UI 3.0 plan in packages/tui-ink one milestone at a time, with strict TODO updates, package-local validation, and extra care around transcript, composer, tool-call, and scrolling hot paths.
compatibility: opencode
metadata:
  project: bettercode
  package: tui-ink
  area: ui-3-0
---

# BetterCode UI 3.0 implementation

Use this skill when:

- the task references `plans/ui-3.0/implementation.md`
- the task is implementing BetterCode UI 3.0
- the task touches `packages/tui-ink` transcript, composer, dock, tool-call, shell, or performance work

## Load these files first

Read these files immediately before making changes:

1. `plans/ui-3.0/implementation.md`
2. `plans/ui-3.0/codex/implementation-review.md`
3. `plans/ui-3.0/codex/final-codex-review.md`
4. `AGENTS.md`

If the task is tied to a specific milestone, then load only the source files for that milestone after reading the plan.

## Core execution rules

- Implement one milestone at a time.
- Keep `plans/ui-3.0/implementation.md` updated during the work.
- Use `[ ]`, `[~]`, `[x]`, `[!]` exactly as defined in the plan.
- Keep at most one `[~]` task in the active milestone.
- Do not start the next milestone until the current one is stable.
- Record decisions, blockers, and deviations in the active milestone notes.
- Prefer small, reviewable diffs. Do not combine multiple milestones in one pass.
- Do not invent architecture beyond what the plan or review calls for.

## Validation rules

Run validation from `packages/tui-ink`, never from repo root.

Required commands:

- `bun typecheck`
- `bun test test/`

Use focused tests while iterating, but always finish the milestone with the full package-local test run.

After every milestone, rerun the manual regression checklist from `plans/ui-3.0/implementation.md`.

## Critical regressions

Guard these surfaces on every milestone:

- streaming sessions
- sticky scroll and detached scroll
- collapsed and expanded tool calls
- keyboard shortcuts and focus ownership
- permission and question flows
- terminal resize while idle
- terminal resize while streaming
- session switching and per-session scroll state
- long transcripts

If any of these regress, stop and fix them before continuing.

## Working set by area

### Shell and status work

- `packages/tui-ink/src/screens/SessionScreen.tsx`
- `packages/tui-ink/src/components/Header.tsx`
- `packages/tui-ink/src/components/StatusBar.tsx`
- `packages/tui-ink/src/components/Sidebar.tsx`

### Transcript and tool-call work

- `packages/tui-ink/src/components/MessageList.tsx`
- `packages/tui-ink/src/components/UserMessage.tsx`
- `packages/tui-ink/src/components/AssistantMessage.tsx`
- `packages/tui-ink/src/components/parts/ToolPart.tsx`
- `packages/tui-ink/src/components/markdown/MarkdownRenderer.tsx`

### Composer and dock work

- `packages/tui-ink/src/components/Composer.tsx`
- `packages/tui-ink/src/components/BottomDock.tsx`
- `packages/tui-ink/src/components/PermissionPrompt.tsx`
- `packages/tui-ink/src/components/QuestionPrompt.tsx`
- `packages/tui-ink/src/components/SlashMenu.tsx`

### State and performance work

- `packages/tui-ink/src/store.ts`
- `packages/tui-ink/src/hooks/useSDK.ts`
- `packages/tui-ink/test/scroll.test.ts`
- `packages/tui-ink/test/integration.test.ts`
- `packages/tui-ink/test/store.test.ts`

## Important constraints

- Do not run tests from repo root.
- Do not use `any` in new code.
- Prefer single-word local names where practical.
- Use parallel tools when gathering context.
- For performance work, preserve correctness first and optimize second.
- For composer work, preserve slash commands, mentions, history, stash, abort, and prompt flows while improving editing behavior.
- For transcript work, keep assistant prose primary and execution detail secondary.

## Stop conditions

Stop and re-check the plan before continuing if:

- the current milestone starts to look like a cross-milestone rewrite
- a task requires a new architectural direction not written in the plan
- scroll behavior changes in a way that is hard to reason about
- the composer loses an existing behavior while a new one is being added
- a performance optimization makes the UI behavior less predictable
