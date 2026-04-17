import { appendFile, rename, stat, mkdir } from "fs/promises"
import { dirname } from "path"
import { paths } from "./paths"

const ENABLED = process.env.BETTERCODE_DEBUG === "1" || process.env.OPENCODE_TUI_DEBUG === "1"
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

// Patterns to redact before writing to log (bearer tokens, env secrets, absolute paths).
const REDACT: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]"],
  [/Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi, "Authorization: Basic [REDACTED]"],
  [/("key"|"secret"|"password"|"token"):\s*"[^"]{4,}"/gi, '"[REDACTED]"'],
  // Absolute paths to home directory
  [new RegExp(process.env.HOME?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "NOMATCH", "g"), "~"],
]

function redact(text: string) {
  for (const [re, sub] of REDACT) {
    text = text.replace(re, sub as string)
  }
  return text
}

let _rotating = false

async function rotate() {
  if (_rotating) return
  _rotating = true
  try {
    const s = await stat(paths.logFile).catch(() => null)
    if (s && s.size > MAX_BYTES) {
      await rename(paths.logFile, `${paths.logFile}.1`).catch(() => {})
    }
  } finally {
    _rotating = false
  }
}

let _ensured = false

async function ensureDir() {
  if (_ensured) return
  await mkdir(dirname(paths.logFile), { recursive: true }).catch(() => {})
  _ensured = true
}

export async function log(level: "info" | "warn" | "error", msg: string, ctx?: unknown) {
  if (!ENABLED) return
  await ensureDir()
  await rotate()
  const line = JSON.stringify({ ts: Date.now(), level, msg: redact(msg), ctx: ctx !== undefined ? JSON.parse(JSON.stringify(ctx)) : undefined }) + "\n"
  await appendFile(paths.logFile, line, "utf8").catch(() => {})
}

export const debugLog = {
  info: (msg: string, ctx?: unknown) => void log("info", msg, ctx),
  warn: (msg: string, ctx?: unknown) => void log("warn", msg, ctx),
  error: (msg: string, ctx?: unknown) => void log("error", msg, ctx),
}
