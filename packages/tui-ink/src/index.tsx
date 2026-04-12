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
