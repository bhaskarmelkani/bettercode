import React from "react"
import { render } from "ink"
import { readFile, writeFile, mkdir, rename } from "fs/promises"
import { dirname } from "path"
import { App } from "./app"
import { useAppStore } from "./store"
import { read as readModel } from "./model"
import { readKeybindings } from "./keybindings"
import { installTerminalCleanup } from "./terminalCleanup"
import { debugLog } from "./debugLog"
import { paths } from "./paths"

export interface TuiInkOptions {
  url: string
  directory?: string
  headers?: Record<string, string>
  sessionID?: string
}

// Prefs write hardening (M2.2): serialize writes with a single-pending coalesce.
let _writing = false
let _pending: Record<string, unknown> | undefined

async function flushPrefs() {
  if (_writing || !_pending) return
  _writing = true
  const prefs = _pending
  _pending = undefined
  const tmp = `${paths.prefsFile}.tmp`
  try {
    await mkdir(dirname(paths.prefsFile), { recursive: true })
    await writeFile(tmp, JSON.stringify(prefs, null, 2), { mode: 0o600 })
    await rename(tmp, paths.prefsFile)
  } catch (err) {
    debugLog.error("prefs write failed", { err: String(err) })
  } finally {
    _writing = false
    if (_pending) void flushPrefs()
  }
}

function schedulePrefsWrite(prefs: Record<string, unknown>) {
  _pending = prefs
  if (!_writing) void flushPrefs()
}

async function readPrefs(): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(paths.prefsFile, "utf8")
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function startTuiInk(opts: TuiInkOptions): Promise<void> {
  // M2.1: install terminal cleanup before anything else
  installTerminalCleanup()

  const prefs = await readPrefs().catch((err) => {
    debugLog.error("prefs read failed", { err: String(err) })
    return {} as Record<string, unknown>
  })
  const keybindings = await readKeybindings()
  const currentModel = readModel(prefs.currentModel)
  const recentModels = Array.isArray(prefs.recentModels)
    ? prefs.recentModels.map(readModel).filter((v): v is { providerID: string; modelID: string } => !!v)
    : []

  useAppStore.setState({
    serverUrl: opts.url,
    directory: opts.directory,
    serverHeaders: opts.headers,
    currentSessionID: opts.sessionID ?? "",
    route: opts.sessionID ? { type: "session", sessionID: opts.sessionID } : { type: "home" },
    ...(typeof prefs.theme === "string" ? { currentThemeName: prefs.theme } : {}),
    ...(Array.isArray(prefs.promptHistory) ? { promptHistory: prefs.promptHistory as string[] } : {}),
    ...(typeof prefs.promptStash === "string" ? { promptStash: prefs.promptStash } : {}),
    ...(currentModel ? { currentModel } : {}),
    ...(recentModels.length > 0 ? { recentModels } : {}),
    keybindings,
    vimEnabled: prefs.vim === true || process.env.OPENCODE_VIM === "1",
    ...(prefs.frecency && typeof prefs.frecency === "object"
      ? { frecency: prefs.frecency as Record<string, { score: number; last: number }> }
      : {}),
    ...(typeof prefs.sidebarMode === "string" &&
    ["collapsed", "compact", "expanded"].includes(prefs.sidebarMode)
      ? { sidebarMode: prefs.sidebarMode as "collapsed" | "compact" | "expanded" }
      : {}),
  })

  // Persist state to disk on change (M2.2: atomic write via schedulePrefsWrite)
  const unsub = useAppStore.subscribe((state, prev) => {
    const changed =
      state.currentThemeName !== prev.currentThemeName ||
      state.promptHistory !== prev.promptHistory ||
      state.promptStash !== prev.promptStash ||
      state.frecency !== prev.frecency ||
      state.currentModel !== prev.currentModel ||
      state.recentModels !== prev.recentModels ||
      state.sidebarMode !== prev.sidebarMode
    if (changed) {
      readPrefs()
        .then((p) =>
          schedulePrefsWrite({
            ...p,
            theme: state.currentThemeName,
            promptHistory: state.promptHistory,
            promptStash: state.promptStash,
            frecency: state.frecency,
            currentModel: state.currentModel,
            recentModels: state.recentModels,
            sidebarMode: state.sidebarMode,
          }),
        )
        .catch((err) => debugLog.error("prefs subscribe read failed", { err: String(err) }))
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
      { exitOnCtrlC: false },
    )
  })
}

export async function main() {
  const url = process.env.BETTERCODE_URL ?? process.env.OPENCODE_TUI_URL ?? "http://localhost:4096"
  const directory = process.env.BETTERCODE_DIR || process.env.OPENCODE_TUI_DIR || undefined
  const sessionID = process.env.BETTERCODE_SESSION || process.env.OPENCODE_TUI_SESSION || undefined
  const password =
    process.env.BETTERCODE_PASSWORD || process.env.OPENCODE_TUI_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD
  const headers: Record<string, string> | undefined = password
    ? { Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
    : undefined

  await startTuiInk({ url, directory, headers, sessionID })
}

// Entry point when spawned as a standalone bun process by the CLI command.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((import.meta as any).main) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
