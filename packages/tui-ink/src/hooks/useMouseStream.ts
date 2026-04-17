import { useEffect } from "react"
import { EventEmitter } from "node:events"

// SGR mouse: ESC [ < Pb ; Px ; Py M/m
const SGR_RE = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/g

export type MouseEvent = {
  btn: number
  x: number
  y: number
  up: boolean
}

export function isLeftDown(btn: number) {
  // Not a scroll (bit 6), not motion (bit 5), button bits 0-1 = 0 (left)
  return (btn & 64) === 0 && (btn & 32) === 0 && (btn & 3) === 0
}

export function isMotion(btn: number) {
  return (btn & 32) !== 0
}

export function isRelease(_btn: number, char: string) {
  return char === "m"
}

export function parseMouse(s: string): MouseEvent[] {
  const list: MouseEvent[] = []
  for (const m of s.matchAll(SGR_RE)) {
    list.push({
      btn: Number(m[1] ?? 0),
      x: Number(m[2] ?? 1) - 1,
      y: Number(m[3] ?? 1) - 1,
      up: m[4] === "m",
    })
  }
  return list
}

// Module-level singleton — all hooks subscribe to this emitter.
export const mouseStream = new EventEmitter()
mouseStream.setMaxListeners(20)

// Refcount: first subscriber enables SGR; last disables it.
let _refCount = 0
let _tail = ""

function onData(buf: Buffer) {
  const raw = `${_tail}${buf.toString("binary")}`
  // Keep partial SGR sequence in tail for next chunk.
  const last = raw.lastIndexOf("\u001b[<")
  const complete = last === -1 || /[Mm]/.test(raw.slice(last)) ? raw : raw.slice(0, last)
  _tail = complete === raw ? "" : raw.slice(last)
  // Cap tail at 4 KB to guard against unterminated sequences.
  if (_tail.length > 4096) _tail = ""

  for (const ev of parseMouse(complete)) {
    const btn = ev.btn
    if (btn === 64) { mouseStream.emit("wheelUp"); continue }
    if (btn === 65) { mouseStream.emit("wheelDown"); continue }
    if (ev.up) { mouseStream.emit("up", ev); continue }
    if (isMotion(btn)) { mouseStream.emit("motion", ev); continue }
    mouseStream.emit("down", ev)
  }
}

function enableSGR() {
  process.stdout.write("\x1b[?1000h\x1b[?1006h")
  process.stdin.on("data", onData)
}

function disableSGR() {
  process.stdout.write("\x1b[?1006l\x1b[?1000l")
  process.stdin.off("data", onData)
}

// useMouseStream — call once per subscriber hook. Manages enable/disable lifecycle.
export function useMouseStream() {
  useEffect(() => {
    if (!process.stdout.isTTY) return
    _refCount++
    if (_refCount === 1) enableSGR()
    return () => {
      _refCount--
      if (_refCount === 0) disableSGR()
    }
  }, [])
}
