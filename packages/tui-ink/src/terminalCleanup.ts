import { debugLog } from "./debugLog"

// ESC sequences: disable mouse, leave alt screen, show cursor.
const RESTORE = "\x1b[?1006l\x1b[?1000l\x1b[?1049l\x1b[?25h"

let installed = false

function cleanup() {
  if (process.stdout.isTTY) {
    process.stdout.write(RESTORE)
  }
}

export function installTerminalCleanup() {
  if (installed) return
  installed = true

  process.on("exit", cleanup)

  process.on("SIGINT", () => {
    cleanup()
    process.exit(130)
  })

  process.on("SIGTERM", () => {
    cleanup()
    process.exit(143)
  })

  process.on("SIGHUP", () => {
    cleanup()
    process.exit(129)
  })

  process.on("uncaughtException", (err) => {
    debugLog.error("uncaughtException", { message: err.message, stack: err.stack })
    cleanup()
    throw err
  })

  process.on("unhandledRejection", (reason) => {
    debugLog.error("unhandledRejection", { reason: String(reason) })
  })
}
