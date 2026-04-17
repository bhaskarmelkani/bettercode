import { homedir } from "os"
import { join } from "path"

// Platform-specific state directory for logs and runtime data.
// Resolution order: BETTERCODE_STATE_DIR, XDG_STATE_HOME, ~/Library/Logs (macOS), ~/.local/state (Linux).
function resolveStateDir() {
  if (process.env.BETTERCODE_STATE_DIR) return process.env.BETTERCODE_STATE_DIR
  if (process.env.XDG_STATE_HOME) return process.env.XDG_STATE_HOME
  const home = homedir()
  if (process.platform === "darwin") return join(home, "Library", "Logs")
  return join(home, ".local", "state")
}

export const paths = {
  get stateDir() {
    return resolveStateDir()
  },
  get logFile() {
    return join(resolveStateDir(), "bettercode", "tui.log")
  },
  get prefsFile() {
    const home = homedir()
    return join(process.env.HOME ?? home, ".config", "bettercode", "prefs.json")
  },
}
