import { spawn } from "node:child_process"
import { readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type ClipboardImage = { data: string; mime: string }

export async function readClipboardImage(): Promise<ClipboardImage | null> {
  if (process.platform === "darwin") return darwinRead()
  if (process.platform === "linux") return linuxRead()
  return null
}

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: Buffer }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] })
    proc.stdout.on("data", (d: Buffer) => chunks.push(d))
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(chunks) }))
  })
}

async function darwinRead(): Promise<ClipboardImage | null> {
  const tmp = join(tmpdir(), `bc-paste-${Date.now()}.png`)
  // Try to coerce clipboard to PNG and write to a temp file via AppleScript.
  const script = `
try
  set imgData to (the clipboard as «class PNGf»)
  set f to open for access POSIX file "${tmp}" with write permission
  write imgData to f
  close access f
  return "ok"
on error
  return "none"
end try`
  const { stdout } = await run("osascript", ["-e", script])
  if (!stdout.toString().trim().startsWith("ok")) return null
  try {
    const buf = await readFile(tmp)
    if (!buf.byteLength) return null
    unlink(tmp).catch(() => {}) // best-effort cleanup
    return { data: buf.toString("base64"), mime: "image/png" }
  } catch {
    return null
  }
}

async function linuxRead(): Promise<ClipboardImage | null> {
  const { code, stdout } = await run("xclip", ["-selection", "clipboard", "-t", "image/png", "-o"])
  if (code !== 0 || !stdout.byteLength) return null
  return { data: stdout.toString("base64"), mime: "image/png" }
}
