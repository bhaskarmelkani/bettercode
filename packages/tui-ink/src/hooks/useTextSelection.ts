import { useEffect, useMemo, useRef, useState } from "react"
import { copy } from "../utils/clipboard"
import { mouseStream, useMouseStream, isLeftDown, isMotion, type MouseEvent } from "./useMouseStream"

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

  // Subscribe to the shared mouseStream instead of attaching a second stdin listener.
  useMouseStream()

  useEffect(() => {
    if (!process.stdin.isTTY) return

    const handle = (item: MouseEvent, up: boolean) => {
      if (!activeRef.current) return
      const { top, left, width, height } = frameRef.current
      const raw = { x: item.x - left, y: item.y - top }
      const inside = raw.x >= 0 && raw.x < width && raw.y >= 0 && raw.y < height

      // pos marks the exclusive-end of the selection.
      const pos = point({ x: raw.x + 1, y: raw.y }, linesRef.current, width, height)

      if (!up && isLeftDown(item.btn) && inside) {
        drag.current = true
        const start = point(raw, linesRef.current, width, height)
        setRange({ start, end: start })
        return
      }

      if (!up && isMotion(item.btn) && drag.current) {
        setRange((prev) => (prev ? { start: prev.start, end: pos } : prev))
        return
      }

      if (up && drag.current) {
        drag.current = false
        // Cancel drag on resize: SIGWINCH clears stdin data, so raw coords may
        // map outside bounds. A release that matches the start point clears the range.
        setRange((prev) => {
          if (!prev) return prev
          if (raw.x === prev.start.x && raw.y === prev.start.y) return undefined
          return { start: prev.start, end: pos }
        })
        queueMicrotask(() => { void doCopy() })
      }
    }

    const onDown = (ev: MouseEvent) => handle(ev, false)
    const onMotion = (ev: MouseEvent) => handle(ev, false)
    const onUp = (ev: MouseEvent) => handle(ev, true)

    mouseStream.on("down", onDown)
    mouseStream.on("motion", onMotion)
    mouseStream.on("up", onUp)

    // Cancel drag on SIGWINCH so there's no stuck highlight.
    const onResize = () => { if (drag.current) { drag.current = false; setRange(undefined) } }
    process.on("SIGWINCH", onResize)

    return () => {
      mouseStream.off("down", onDown)
      mouseStream.off("motion", onMotion)
      mouseStream.off("up", onUp)
      process.off("SIGWINCH", onResize)
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
