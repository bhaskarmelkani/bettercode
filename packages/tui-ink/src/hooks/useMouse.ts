import { useEffect } from "react"
import { mouseScrollEvents } from "../mouseScrollEvents"

// SGR mouse: ESC [ < Pb ; Px ; Py M/m
// Scroll up:   Pb = 64
// Scroll down: Pb = 65
const SGR_RE = /\x1b\[<(\d+);\d+;\d+[Mm]/

export function useMouse() {
  useEffect(() => {
    if (!process.stdout.isTTY) return

    // Enable SGR extended mouse reporting (covers scroll wheel on all modern terminals)
    process.stdout.write("\x1b[?1000h\x1b[?1006h")

    const onData = (buf: Buffer) => {
      const s = buf.toString("binary")
      const m = SGR_RE.exec(s)
      if (m) {
        const btn = parseInt(m[1]!, 10)
        if (btn === 64) mouseScrollEvents.emit("up")
        else if (btn === 65) mouseScrollEvents.emit("down")
      }
    }

    process.stdin.on("data", onData)

    return () => {
      // Disable mouse reporting on unmount
      process.stdout.write("\x1b[?1006l\x1b[?1000l")
      process.stdin.off("data", onData)
    }
  }, [])
}
