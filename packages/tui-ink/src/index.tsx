import React from "react"
import { render } from "ink"
import { App } from "./app"
import { useAppStore } from "./store"

export interface TuiInkOptions {
  url: string
  directory?: string
  headers?: Record<string, string>
  sessionID?: string
}

export async function startTuiInk(opts: TuiInkOptions): Promise<void> {
  useAppStore.setState({
    serverUrl: opts.url,
    directory: opts.directory,
    serverHeaders: opts.headers,
    currentSessionID: opts.sessionID ?? "",
    projectName: opts.directory?.split("/").pop() ?? "bettercode",
  })

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <App
        onExit={() => {
          unmount()
          resolve()
        }}
      />,
    )

    process.on("SIGINT", () => {
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
  const url = process.env.OPENCODE_TUI_URL ?? "http://localhost:4096"
  const directory = process.env.OPENCODE_TUI_DIR || undefined
  const sessionID = process.env.OPENCODE_TUI_SESSION || undefined
  const password = process.env.OPENCODE_TUI_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD
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
