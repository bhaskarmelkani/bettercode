import React from "react"
import { render } from "ink"
import { readFile, writeFile, mkdir } from "fs/promises"
import { dirname, join } from "path"
import { App } from "./app"
import { useAppStore } from "./store"

export interface TuiInkOptions {
  url: string
  directory?: string
  headers?: Record<string, string>
  sessionID?: string
}

const PREFS_PATH = join(process.env.HOME ?? process.env.USERPROFILE ?? "~", ".config", "bettercode", "prefs.json")

async function readPrefs(): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(PREFS_PATH, "utf8")
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function writePrefs(prefs: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(dirname(PREFS_PATH), { recursive: true })
    await writeFile(PREFS_PATH, JSON.stringify(prefs, null, 2))
  } catch {
    // best-effort
  }
}

export async function startTuiInk(opts: TuiInkOptions): Promise<void> {
  const prefs = await readPrefs()

  useAppStore.setState({
    serverUrl: opts.url,
    directory: opts.directory,
    serverHeaders: opts.headers,
    currentSessionID: opts.sessionID ?? "",
    route: opts.sessionID ? { type: "session", sessionID: opts.sessionID } : { type: "home" },
    ...(typeof prefs.theme === "string" ? { currentThemeName: prefs.theme } : {}),
    ...(Array.isArray(prefs.promptHistory) ? { promptHistory: prefs.promptHistory as string[] } : {}),
    ...(typeof prefs.promptStash === "string" ? { promptStash: prefs.promptStash } : {}),
    ...(prefs.frecency && typeof prefs.frecency === "object"
      ? { frecency: prefs.frecency as Record<string, { score: number; last: number }> }
      : {}),
  })

  // Persist theme + prompt history + stash to disk on change
  const unsub = useAppStore.subscribe((state, prev) => {
    const changed =
      state.currentThemeName !== prev.currentThemeName ||
      state.promptHistory !== prev.promptHistory ||
      state.promptStash !== prev.promptStash ||
      state.frecency !== prev.frecency
    if (changed) {
      readPrefs().then((p) =>
        writePrefs({
          ...p,
          theme: state.currentThemeName,
          promptHistory: state.promptHistory,
          promptStash: state.promptStash,
          frecency: state.frecency,
        }),
      )
    }
  })

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <App
        onExit={() => {
          unsub()
          unmount()
          resolve()
        }}
      />,
    )

    process.on("SIGINT", () => {
      unsub()
      unmount()
      resolve()
    })
  })
}

// Entry point when spawned as a standalone bun process by the CLI command.
// import.meta.main is true only when this file is the direct entrypoint passed
// to `bun run` — it is false when the module is imported by another file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((import.meta as any).main) {
  const url = process.env.BETTERCODE_URL ?? process.env.OPENCODE_TUI_URL ?? "http://localhost:4096"
  const directory = process.env.BETTERCODE_DIR || process.env.OPENCODE_TUI_DIR || undefined
  const sessionID = process.env.BETTERCODE_SESSION || process.env.OPENCODE_TUI_SESSION || undefined
  const password =
    process.env.BETTERCODE_PASSWORD || process.env.OPENCODE_TUI_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD
  const headers: Record<string, string> | undefined = password
    ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
    : undefined

  startTuiInk({ url, directory, headers, sessionID })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
