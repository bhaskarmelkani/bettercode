# Contributing to BetterCode

Thank you for your interest in contributing! Please read this document before opening a PR.

## Code of conduct

This project follows the [opencode Code of Conduct](../../CODE_OF_CONDUCT.md) (see repo root). Be respectful and constructive.

## Getting started

```bash
# From repo root
bun install

# Run the TUI against a running opencode server
./packages/opencode/bin/bettercode

# Type-check (from packages/tui-ink)
bun typecheck

# Run tests (from packages/tui-ink — never from repo root)
bun test test/
```

## Coding conventions

Follow the style guide in [`CLAUDE.md`](../../CLAUDE.md) at the repo root. Key rules:

- **Single-word names** by default for locals, params, helpers. Multi-word only when genuinely ambiguous.
- **Prefer dot notation** over unnecessary destructuring.
- **`const` over `let`**; ternaries or early returns over reassignment.
- **No `else`** when an early return is clearer.
- **Functional array methods** (`flatMap`, `filter`, `map`) over `for` loops.
- **No comments** unless the WHY is non-obvious (a hidden constraint, subtle invariant, workaround).
- **`bun typecheck`** must be clean before opening a PR.

## Tests

- Add tests in `test/` for new logic. Do not duplicate logic into tests — test the actual implementation.
- Snapshot tests are in `test/__snapshots__/`. Human-review every snapshot diff; never auto-regenerate without reading the diff.
- `bun test test/<file>.test.ts` to run a focused test.

## Adding snapshots

```bash
# From packages/tui-ink
bun run snapshots
```

After running, diff the snapshot file manually and verify the visual output is correct before committing.

## Submitting a PR

1. One task per commit is ideal; at most a few related tasks.
2. Run `bun typecheck && bun test test/` before pushing.
3. If your change touches the manual regression checklist in `plans/v1.0.0/implementation.md`, note which items you verified.
4. Fill out the PR template.

## Architecture notes

- **State**: Zustand store in `src/store.ts` is the single source of truth. Add to it carefully; new fields need initial values and (if persisted) entries in `src/index.tsx`'s subscribe callback.
- **Mouse**: All mouse input flows through `src/hooks/useMouseStream.ts`. Do not add more `process.stdin.on("data")` listeners — subscribe to the `mouseStream` EventEmitter instead.
- **Terminal cleanup**: Call `installTerminalCleanup()` in any new entry point before rendering. This is idempotent.
- **Debug log**: Use `debugLog.info/warn/error` from `src/debugLog.ts` for operational messages. Never use `console.log` or `console.error` inside the TUI — it corrupts the Ink frame.
