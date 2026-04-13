import { cmd } from "./cmd"
import { spawn } from "child_process"
import path from "path"
import { bootstrap } from "../bootstrap"
import { Server } from "../../server/server"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Filesystem } from "../../util/filesystem"

export const BettercodeCommand = cmd({
  command: "bettercode [project]",
  describe: "start bettercode (server + Ink TUI in one command)",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start bettercode in (defaults to cwd)",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session ID to open",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to OPENCODE_SERVER_PASSWORD)",
      }),

  handler: async (args) => {
    const root = Filesystem.resolve(process.env.PWD ?? process.cwd())
    const cwd = args.project
      ? Filesystem.resolve(path.isAbsolute(args.project) ? args.project : path.join(root, args.project))
      : root

    try {
      process.chdir(cwd)
    } catch {
      // ignore — cwd stays as-is if chdir fails
    }

    const tuiEntry = path.resolve(import.meta.dirname, "../../../../tui-ink/src/index.tsx")
    const password = args.password ?? process.env.OPENCODE_SERVER_PASSWORD

    await bootstrap(cwd, async () => {
      const opts = await resolveNetworkOptions(args)
      const server = await Server.listen(opts)
      const url = `http://${server.hostname}:${server.port}`

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        BETTERCODE_URL: url,
        BETTERCODE_DIR: cwd,
      }
      if (args.session) env.BETTERCODE_SESSION = args.session
      if (password) env.BETTERCODE_PASSWORD = password

      const child = spawn("bun", ["run", tuiEntry], { stdio: "inherit", env })
      const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject)
        child.once("exit", (code, signal) => {
          resolve({ code, signal })
        })
      })

      await server.stop()

      if (result.signal) process.kill(process.pid, result.signal)
      if (result.code && result.code !== 0) process.exitCode = result.code
    })
  },
})
