import { useEffect, useMemo, useRef, useState } from "react"
import { copy } from "../utils/clipboard"

export type Point = {
  x: number
  y: number
}

type Range = {
  start: Point
  end: Point
}

type Row = {
  x: number
  y: number
  text: string
}

type Input = {
  active: boolean
  detached: boolean
  lines: string[]
  width: number
  height: number
  top: number
  left?: number
  onCopy?: (text: string, ok: boolean) => void
}

type Mouse = {
  btn: number
  x: number
  y: number
  up: boolean
}

const SGR_RE = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/g

let globalCopy: (() => Promise<boolean>) | undefined

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function same(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

function sort(start: Point, end: Point) {
  if (start.y < end.y) return { start, end }
  if (start.y > end.y) return { start: end, end: start }
  if (start.x <= end.x) return { start, end }
  return { start: end, end: start }
}

function point(raw: Point, lines: string[], width: number, height: number) {
  const y = clamp(raw.y, 0, Math.max(0, height - 1))
  const line = lines[y] ?? ""
  return {
    x: clamp(raw.x, 0, Math.min(width, line.length)),
    y,
  }
}

export function sliceSelection(lines: string[], start?: Point, end?: Point) {
  if (!start || !end) return ""
  if (same(start, end)) return ""
  const range = sort(start, end)
  return lines
    .slice(range.start.y, range.end.y + 1)
    .map((line, idx, list) => {
      if (idx === 0 && idx === list.length - 1) return line.slice(range.start.x, range.end.x)
      if (idx === 0) return line.slice(range.start.x)
      if (idx === list.length - 1) return line.slice(0, range.end.x)
      return line
    })
    .join("\n")
    .replace(/\s+$/g, "")
}

export function selectionRows(lines: string[], start?: Point, end?: Point) {
  if (!start || !end || same(start, end)) return [] as Row[]
  const range = sort(start, end)
  const rows: Row[] = []
  for (let y = range.start.y; y <= range.end.y; y++) {
    const line = lines[y] ?? ""
    const left = y === range.start.y ? range.start.x : 0
    const right = y === range.end.y ? range.end.x : line.length
    const text = line.slice(left, right)
    if (!text) continue
    rows.push({ x: left, y, text })
  }
  return rows
}

export async function handleGlobalCopy() {
  return globalCopy ? globalCopy() : false
}

function parseMouse(data: string) {
  const list: Mouse[] = []
  for (const item of data.matchAll(SGR_RE)) {
    const btn = Number(item[1] ?? 0)
    if (btn === 64 || btn === 65) continue
    list.push({
      btn,
      x: Number(item[2] ?? 1) - 1,
      y: Number(item[3] ?? 1) - 1,
      up: item[4] === "m",
    })
  }
  return list
}

export function useTextSelection(input: Input) {
  const [range, setRange] = useState<Range>()
  const drag = useRef(false)
  const linesRef = useRef(input.lines)
  const activeRef = useRef(input.active)
  const detachedRef = useRef(input.detached)
  const rangeRef = useRef(range)
  const frameRef = useRef({
    width: input.width,
    height: input.height,
    top: input.top,
    left: input.left ?? 0,
  })
  const tail = useRef("")
  const copyRef = useRef(input.onCopy)

  linesRef.current = input.lines
  activeRef.current = input.active
  detachedRef.current = input.detached
  rangeRef.current = range
  copyRef.current = input.onCopy
  frameRef.current = {
    width: input.width,
    height: input.height,
    top: input.top,
    left: input.left ?? 0,
  }

  const text = useMemo(() => sliceSelection(input.lines, range?.start, range?.end), [input.lines, range])
  const rows = useMemo(() => selectionRows(input.lines, range?.start, range?.end), [input.lines, range])

  async function doCopy() {
    const r = rangeRef.current
    const text = sliceSelection(linesRef.current, r?.start, r?.end)
    if (!text) return false
    const ok = await copy(text)
    copyRef.current?.(text, ok)
    return ok
  }

  useEffect(() => {
    globalCopy = async () => {
      if (!activeRef.current) return false
      const r = rangeRef.current
      const text = sliceSelection(linesRef.current, r?.start, r?.end)
      if (text) {
        const ok = await copy(text)
        copyRef.current?.(text, ok)
        return true
      }
      return detachedRef.current
    }
    return () => {
      if (globalCopy) globalCopy = undefined
    }
  }, [])

  useEffect(() => {
    if (!process.stdin.isTTY) return

    const onData = (buf: Buffer) => {
      const head = `${tail.current}${buf.toString("binary")}`
      const last = head.lastIndexOf("\u001b[<")
      const done = last === -1 || /[Mm]/.test(head.slice(last)) ? head : head.slice(0, last)
      tail.current = done === head ? "" : head.slice(last)

      for (const item of parseMouse(done)) {
        if (!activeRef.current) continue
        const top = frameRef.current.top
        const left = frameRef.current.left
        const raw = {
          x: item.x - left,
          y: item.y - top,
        }
        const inside = raw.x >= 0 && raw.x < frameRef.current.width && raw.y >= 0 && raw.y < frameRef.current.height

        if (!drag.current && !inside) continue

        // pos marks the exclusive-end of the selection (includes char under cursor on release)
        const pos = point({ x: raw.x + 1, y: raw.y }, linesRef.current, frameRef.current.width, frameRef.current.height)

        if (!item.up && (item.btn & 32) === 0 && (item.btn & 3) === 0 && inside) {
          drag.current = true
          const start = point(raw, linesRef.current, frameRef.current.width, frameRef.current.height)
          setRange({ start, end: start })
          continue
        }

        if (!item.up && drag.current && (item.btn & 32) !== 0) {
          setRange((prev) => (prev ? { start: prev.start, end: pos } : prev))
          continue
        }

        if (item.up && drag.current) {
          drag.current = false
          setRange((prev) => {
            if (!prev) return prev
            if (raw.x === prev.start.x && raw.y === prev.start.y) return undefined
            return { start: prev.start, end: pos }
          })
          queueMicrotask(() => {
            void doCopy()
          })
        }
      }
    }

    process.stdin.on("data", onData)
    return () => {
      process.stdin.off("data", onData)
    }
  }, [])

  return {
    active: !!range && !!text,
    rows,
    text,
    clear: () => setRange(undefined),
    copy: doCopy,
  }
}
