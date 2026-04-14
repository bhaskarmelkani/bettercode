- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## BetterCode UI 3.0

- When the task touches `packages/tui-ink` UI/UX/performance work or references `plans/ui-3.0`, read these files first:
  - `plans/ui-3.0/implementation.md`
  - `plans/ui-3.0/codex/implementation-review.md`
  - `plans/ui-3.0/codex/final-codex-review.md`
- The implementation executor is OpenCode. Treat it like a junior engineer:
  - implement one milestone at a time
  - keep the TODO statuses in `plans/ui-3.0/implementation.md` updated
  - do not skip validation gates
  - do not start the next milestone until the current milestone is stable
- Prefer the project-local skill for this work:
  - `.opencode/skills/bettercode-ui-implementation/SKILL.md`
- The main TUI hot-path files are:
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
- Critical regressions to guard on every UI 3.0 milestone:
  - streaming sessions
  - sticky scroll and detached scroll
  - collapsed/expanded tool calls
  - keyboard shortcuts and focus ownership
  - permission/question flows
  - terminal resize while idle and while streaming
  - session switching and per-session scroll state
  - long transcripts
- For UI 3.0 work, always validate from `packages/tui-ink` with:
  - `bun typecheck`
  - `bun test test/`
- Do not run tests from repo root.
- Avoid broad rewrites in `packages/tui-ink`. Small milestone-sized changes are preferred over large multi-surface refactors.
- For performance work, fix correctness and scroll stability first, then optimize.
- For composer work, preserve slash commands, mentions, history, stash, abort, and prompt flows while improving editing behavior.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.
