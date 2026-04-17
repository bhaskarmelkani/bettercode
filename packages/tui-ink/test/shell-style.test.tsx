import React from "react"
import { describe, expect, test } from "bun:test"
import { Box, Text } from "ink"
import { ThemeProvider } from "../src/theme-context"
import { capture } from "../src/testing/render"
import { useAppStore } from "../src/store"
import { Header } from "../src/components/Header"
import { StatusBar } from "../src/components/StatusBar"
import { SlashMenu } from "../src/components/SlashMenu"
import { ModelPickerDialog } from "../src/components/ModelPickerDialog"
import { progressBar } from "../src/components/TokenWarning"

function reset() {
  useAppStore.setState({
    currentThemeName: "catppuccin-mocha",
    currentSessionID: "",
    vcs: undefined,
    sessionStatus: {},
    messages: {},
    messageDiff: {},
    permissions: {},
    questions: {},
    dialogs: [],
    composerStatus: "idle",
    currentModel: undefined,
    mode: "build",
    providers: [],
    providerConnected: [],
    recentModels: [],
  })
}

async function src(path: string) {
  return Bun.file(new URL(path, import.meta.url)).text()
}

describe("shell style regressions", () => {
  test("header stays text-first without background fill", async () => {
    reset()
    const frame = await capture(
      <ThemeProvider>
        <Header projectName="bettercode" gitBranch="bhaskar/ui-3.0" status="idle" width={80} />
      </ThemeProvider>,
      { columns: 80, rows: 1 },
    )

    expect(frame.text).toContain("bettercode ─ ⎇ bhaskar/ui-3.0")
    expect(frame.text).toContain("ready")
  })

  test("status bar stays text-first without background fill", async () => {
    reset()
    useAppStore.setState({
      currentSessionID: "s-1",
      currentModel: { providerID: "github-copilot", modelID: "gpt-5-mini" },
      vcs: { branch: "bhaskar/ui-3.0" } as NonNullable<ReturnType<typeof useAppStore.getState>["vcs"]>,
      sessionStatus: { "s-1": { type: "idle" } },
    })

    const frame = await capture(
      <ThemeProvider>
        <StatusBar width={100} />
      </ThemeProvider>,
      { columns: 100, rows: 1 },
    )

    expect(frame.text).toContain("build (shift + tab) · gpt-5-mini")
    expect(frame.text).toContain("ctrl+k: commands · /: slash")
  })

  test("token warning bar supports partial blocks", () => {
    expect(progressBar(0.375, 4)).toBe("█▌  ")
  })

  test("status bar shows context warning and compact hint", async () => {
    reset()
    useAppStore.setState({
      currentSessionID: "s-1",
      currentModel: { providerID: "github-copilot", modelID: "gpt-5-mini" },
      vcs: { branch: "bhaskar/ui-3.0" } as NonNullable<ReturnType<typeof useAppStore.getState>["vcs"]>,
      sessionStatus: { "s-1": { type: "idle" } },
      providers: [
        {
          id: "github-copilot",
          name: "GitHub Copilot",
          source: "api",
          env: [],
          options: {},
          models: {
            "gpt-5-mini": {
              name: "GPT-5 mini",
              cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
              limit: { context: 200_000, output: 8192 },
              status: "active",
              options: {},
              headers: {},
              release_date: "2026-01-01",
            },
          },
        },
      ] as ReturnType<typeof useAppStore.getState>["providers"],
      messages: {
        "s-1": [
          {
            id: "m-1",
            sessionID: "s-1",
            role: "assistant",
            providerID: "github-copilot",
            modelID: "gpt-5-mini",
            mode: "build",
            agent: "build",
            path: { cwd: "/tmp", root: "/tmp" },
            cost: 0,
            tokens: {
              total: 180_000,
              input: 0,
              output: 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
          },
        ],
      },
    })

    const frame = await capture(
      <ThemeProvider>
        <StatusBar width={100} />
      </ThemeProvider>,
      { columns: 100, rows: 2 },
    )

    expect(frame.text).toContain("Context critical — 10% remaining")
    expect(frame.text).toContain("/compact")
  })

  test("slash menu keeps source labels without row slab backgrounds", async () => {
    reset()
    const frame = await capture(
      <ThemeProvider>
        <Box position="relative" flexDirection="column">
          <Text>{" "}</Text>
          <Text>{" "}</Text>
          <Text>{" "}</Text>
          <Text>{" "}</Text>
          <SlashMenu
            width={90}
            focused={1}
            options={[
              { name: "clear", description: "Clear composer input", source: "local" },
              { name: "compact", description: "Summarize the current session", source: "command" },
              { name: "mcp", description: "Open MCP connections and auth status", source: "mcp", hints: ["status"] },
              { name: "skill", description: "Run a reusable skill with optional arguments", source: "skill", hints: ["<name>"] },
            ]}
          />
        </Box>
      </ThemeProvider>,
      { columns: 90, rows: 8 },
    )

    expect(frame.text).toContain("[SKILL] <name>")
    expect(frame.text).toContain("/skill")
  })

  test("model picker keeps text-first list styling", async () => {
    reset()
    useAppStore.setState({
      providers: [
        {
          id: "github-copilot",
          name: "GitHub Copilot",
          models: {
            "gpt-5-mini": { name: "GPT-5 mini (0x)" },
            "claude-haiku-4.5": { name: "Claude Haiku 4.5 (0.33x)" },
          },
        },
      ] as unknown as ReturnType<typeof useAppStore.getState>["providers"],
      providerConnected: ["github-copilot"],
      currentModel: { providerID: "github-copilot", modelID: "gpt-5-mini" },
      recentModels: [{ providerID: "github-copilot", modelID: "gpt-5-mini" }],
    })

    const frame = await capture(
      <ThemeProvider>
        <ModelPickerDialog rows={12} columns={100} />
      </ThemeProvider>,
      { columns: 100, rows: 12 },
    )

    expect(frame.text).toContain("Model current: gpt-5-mini")
    expect(frame.text).toContain("GPT-5 mini (0x)  github-copilot ✓")
  })

  test("shell source files keep background-free styling invariants", async () => {
    const header = await src("../src/components/Header.tsx")
    const status = await src("../src/components/StatusBar.tsx")
    const slash = await src("../src/components/SlashMenu.tsx")
    const model = await src("../src/components/ModelPickerDialog.tsx")
    const prompt = await src("../src/components/PermissionPrompt.tsx")

    expect(header).not.toContain("backgroundColor=")
    expect(status).not.toContain("backgroundColor=")
    expect(slash).not.toContain("backgroundColor=")
    expect(model).not.toContain("backgroundColor=")
    expect(slash).toContain('cmd.source === "mcp" ? "MCP"')
    expect(slash).toContain('cmd.source === "skill" ? "SKILL"')
    expect(slash).toContain('cmd.source === "command" ? "CMD"')
    expect(slash).toContain('"LOCAL"')
    expect(prompt).toContain("backgroundColor={color}")
  })
})
