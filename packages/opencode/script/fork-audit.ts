#!/usr/bin/env bun

import { $ } from "bun"

const base = process.argv[2] || "origin/dev"
const keep = [
  "packages/opencode/src/cli/cmd/tui/",
  "packages/opencode/src/fork/",
  "packages/opencode/src/global/index.ts",
  "packages/opencode/src/config/paths.ts",
  "packages/opencode/src/config/config.ts",
  "packages/opencode/src/config/tui.ts",
  "packages/opencode/src/config/tui-migrate.ts",
  "packages/opencode/src/installation/index.ts",
  "packages/opencode/src/session/index.ts",
  "packages/opencode/src/agent/agent.ts",
  "packages/opencode/src/plugin/install.ts",
  "packages/opencode/src/file/ripgrep.ts",
  "packages/opencode/src/cli/cmd/agent.ts",
  "packages/opencode/src/cli/cmd/mcp.ts",
  "packages/opencode/src/cli/cmd/pr.ts",
  "packages/opencode/package.json",
  "packages/opencode/bin/bettercode",
  "packages/opencode/test/config/tui.test.ts",
  "packages/opencode/FORKING.md",
  "packages/opencode/script/fork-audit.ts",
]

const out = await $`git diff --name-only ${base}...HEAD`.text()
const files = out
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean)

const bad = files.filter((file) => !keep.some((item) => file.startsWith(item) || file === item))

if (bad.length === 0) {
  console.log(`fork audit passed against ${base}`)
  process.exit(0)
}

console.error(`fork audit found changes outside the BetterCode surface against ${base}`)
for (const file of bad) {
  console.error(`- ${file}`)
}
process.exit(1)
