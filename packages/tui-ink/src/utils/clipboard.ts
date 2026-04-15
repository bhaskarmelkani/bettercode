import { spawn, spawnSync } from "node:child_process"

type Clip = {
  cmd: string[]
  osc52?: boolean
}

function has(cmd: string) {
  return spawnSync("sh", ["-lc", `command -v ${cmd} >/dev/null 2>&1`], { stdio: "ignore" }).status === 0
}

function pick(): Clip {
  if (process.platform === "darwin" && has("pbcopy")) return { cmd: ["pbcopy"] }

  if (process.platform === "linux" && process.env.WAYLAND_DISPLAY && has("wl-copy")) {
    return { cmd: ["wl-copy"] }
  }

  if (process.platform === "linux" && process.env.DISPLAY && has("xclip")) {
    return { cmd: ["xclip", "-selection", "clipboard"] }
  }

  if (process.env.TMUX && has("tmux")) return { cmd: ["tmux", "load-buffer", "-"] }

  return { cmd: [], osc52: true }
}

async function run(cmd: string[], text: string) {
  return new Promise<boolean>((resolve) => {
    const proc = spawn(cmd[0]!, cmd.slice(1), {
      stdio: ["pipe", "ignore", "ignore"],
    })
    proc.stdin.write(text)
    proc.stdin.end()
    proc.on("exit", (code) => resolve((code ?? 1) === 0))
  })
}

export function osc52(text: string) {
  const body = Buffer.from(text).toString("base64")
  process.stdout.write(`\u001b]52;c;${body}\u0007`)
  return true
}

export function clipboardTarget() {
  return pick()
}

export async function copy(text: string) {
  if (!text) return false
  const clip = pick()
  if (clip.osc52) return osc52(text)
  return run(clip.cmd, text)
}
