# BetterCode fork boundary

This fork keeps the OpenCode core as close to upstream as possible and isolates intentional product divergence behind a small BetterCode-owned surface.

## Allowed divergence

- `packages/opencode/src/cli/cmd/tui/**`
- `packages/opencode/src/fork/**`
- `packages/opencode/src/global/index.ts`
- `packages/opencode/src/config/paths.ts`
- `packages/opencode/src/config/config.ts`
- `packages/opencode/src/config/tui.ts`
- `packages/opencode/src/config/tui-migrate.ts`
- `packages/opencode/src/installation/index.ts`
- `packages/opencode/src/session/index.ts`
- `packages/opencode/src/agent/agent.ts`
- `packages/opencode/src/plugin/install.ts`
- `packages/opencode/src/file/ripgrep.ts`
- `packages/opencode/src/cli/cmd/agent.ts`
- `packages/opencode/src/cli/cmd/mcp.ts`
- `packages/opencode/src/cli/cmd/pr.ts`
- `packages/opencode/package.json`
- `packages/opencode/bin/bettercode`
- `packages/opencode/test/config/tui.test.ts`
- `packages/opencode/FORKING.md`
- `packages/opencode/script/fork-audit.ts`

## Protected core

Avoid fork-only edits in these areas unless a TUI requirement cannot be met through a small additive seam:

- agent definitions and prompts
- providers and model plumbing
- tool registry and tool execution
- session processing and storage contracts
- RPC/server routes and SDK-facing contracts
- config schema semantics

## Sync expectations

- Merge from upstream `dev` into the fork regularly.
- Keep BetterCode branding and UI changes in the fork-owned surface.
- Prefer small host seams that delegate to fork-owned modules over inline patches in upstream files.
- Keep brand and coexistence changes limited to the explicit namespace seam files listed above.
- Run `bun run fork:audit` from `packages/opencode` after upstream syncs to catch drift outside the allowed zones.

## Placement rules

- If a change only affects presentation or interaction in the terminal UI, put it in the TUI surface or `src/fork`.
- If a change is generic, reusable, and safe for upstream, keep it additive and framework-neutral.
- If a change would alter behavior for non-TUI clients, assume it belongs in shared core and justify it before editing.
