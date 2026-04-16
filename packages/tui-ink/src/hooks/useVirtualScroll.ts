import React from "react"

export type Range = {
  start: number
  end: number
}

export const PESSIMISTIC_HEIGHT = 1
export const OVERSCAN = 80
export const QUANTUM = 40
export const SLIDE = 25

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function item(list: ArrayLike<number>, idx: number) {
  const n = list[idx]
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : PESSIMISTIC_HEIGHT
}

export function buildOffsets(list: ArrayLike<number>) {
  const out = new Float64Array(list.length + 1)
  for (let i = 0; i < list.length; i++) out[i + 1] = out[i]! + item(list, i)
  return out
}

function lower(list: ArrayLike<number>, n: number) {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((list[mid] ?? 0) < n) lo = mid + 1
    else hi = mid
  }
  return lo
}

function upper(list: ArrayLike<number>, n: number) {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((list[mid] ?? 0) <= n) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function quantize(n: number, step = QUANTUM) {
  if (n <= 0) return 0
  return Math.round(n / step) * step
}

export function visible(offsets: ArrayLike<number>, top: number, height: number): Range {
  const total = Math.max(0, offsets.length - 1)
  if (total === 0) return { start: 0, end: 0 }
  const max = Math.max(0, (offsets[total] ?? 0) - 1)
  const start = clamp(upper(offsets, clamp(top, 0, max)) - 1, 0, total - 1)
  const end = clamp(lower(offsets, Math.max(top, 0) + Math.max(1, height)), start + 1, total)
  return { start, end }
}

export function overscan(list: ArrayLike<number>, range: Range, rows = OVERSCAN): Range {
  if (range.end <= range.start) return range
  let start = range.start
  let end = range.end
  let top = rows
  let bottom = rows

  while (start > 0 && top > 0) {
    start--
    top -= item(list, start)
  }

  while (end < list.length && bottom > 0) {
    bottom -= item(list, end)
    end++
  }

  return { start, end }
}

export function capRange(prev: Range, next: Range, step = SLIDE): Range {
  if (next.end <= next.start) return next
  if (prev.end <= prev.start) return next
  if (next.end <= prev.start || next.start >= prev.end) return next
  const start = Math.abs(next.start - prev.start) <= step ? next.start : prev.start + Math.sign(next.start - prev.start) * step
  const end = Math.abs(next.end - prev.end) <= step ? next.end : prev.end + Math.sign(next.end - prev.end) * step
  return end > start ? { start, end } : next
}

export function spacers(offsets: ArrayLike<number>, total: number, range: Range) {
  const top = offsets[range.start] ?? total
  const bottom = Math.max(0, total - (offsets[range.end] ?? total))
  return { top, bottom }
}

export function useVirtualScroll({
  list,
  top,
  height,
  rows = OVERSCAN,
  quantum = QUANTUM,
  slide = SLIDE,
}: {
  list: ArrayLike<number>
  top: number
  height: number
  rows?: number
  quantum?: number
  slide?: number
}) {
  const offsets = React.useMemo(() => buildOffsets(list), [list])
  const total = offsets[offsets.length - 1] ?? 0
  const vis = React.useMemo(() => visible(offsets, top, height), [height, offsets, top])
  const qTop = React.useMemo(() => clamp(quantize(top, quantum), 0, Math.max(0, total - height)), [height, quantum, top, total])
  const target = React.useMemo(() => overscan(list, visible(offsets, qTop, height), rows), [height, list, offsets, qTop, rows])
  const slow = React.useDeferredValue(target)
  const prev = React.useRef<Range>({ start: 0, end: 0 })
  const win = React.useMemo(() => capRange(prev.current, slow, slide), [slide, slow])

  React.useEffect(() => {
    prev.current = win
  }, [win])

  const gap = React.useMemo(() => spacers(offsets, total, win), [offsets, total, win])

  return {
    offsets,
    total,
    visStart: vis.start,
    visEnd: vis.end,
    winStart: win.start,
    winEnd: win.end,
    topSpacer: gap.top,
    bottomSpacer: gap.bottom,
  }
}
