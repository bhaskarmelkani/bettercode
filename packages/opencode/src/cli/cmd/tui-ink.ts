import { cmd } from "./cmd"
import { spawnSync } from "child_process"
import path from "path"

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

    const password = args.password ?? process.env.OPENCODE_SERVER_PASSWORD

    // Resolve the tui-ink entry point relative to this file.
    // We spawn a fresh bun process (no --conditions=browser) so that React /
    // react-reconciler / ink all resolve to the same module instance and the
    // React dispatcher is set up correctly before any hook fires.
    const tuiEntry = path.resolve(import.meta.dirname, "../../../../tui-ink/src/index.tsx")

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCODE_TUI_URL: args.url as string,
    }
    if (directory) env.OPENCODE_TUI_DIR = directory
    if (args.session) env.OPENCODE_TUI_SESSION = args.session
    if (password) env.OPENCODE_TUI_PASSWORD = password

    const result = spawnSync("bun", ["run", tuiEntry], {
      stdio: "inherit",
      env,
    })

    if (result.error) {
      throw result.error
    }
  },
})
