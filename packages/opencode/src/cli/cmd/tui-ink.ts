import { cmd } from "./cmd"

type TuiInkMod = {
  startTuiInk: (opts: {
    url: string
    directory?: string
    headers?: Record<string, string>
    sessionID?: string
  }) => Promise<void>
}

export const TuiInkCommand = cmd({
  command: "tui-ink [url]",
  describe: "launch the Ink-based TUI (bettercode surface)",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "opencode server URL",
        default: "http://localhost:4096",
      })
      .option("dir", {
        type: "string",
        description: "working directory",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session ID to open",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password",
      }),

  handler: async (args) => {
    const directory = (() => {
      if (!args.dir) return undefined
      try {
        process.chdir(args.dir)
        return process.cwd()
      } catch {
        return args.dir
      }
    })()

    const headers = (() => {
      const password = args.password ?? process.env.OPENCODE_SERVER_PASSWORD
      if (!password) return undefined
      const auth = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`
      return { Authorization: auth }
    })()

    // Use a variable to avoid tsgo statically following JSX module types
    const pkg = "@opencode-ai/tui-ink" as string
    const mod = (await import(/* @vite-ignore */ pkg)) as TuiInkMod

    await mod.startTuiInk({
      url: args.url as string,
      directory,
      headers,
      sessionID: args.session,
    })
  },
})
