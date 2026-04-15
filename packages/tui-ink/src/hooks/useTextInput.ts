import { useRef, useState } from "react"
import { useUndoBuffer } from "./useUndoBuffer"

// Append-only helpers — kept for M4 test backward compat.
export function textInsert(value: string, input: string): string {
  return value + input
}

export function textDel(value: string): string {
  return value.slice(0, -1)
}

// Cursor-aware pure helpers — exported for M5 tests.

// Insert text at cursor; returns [nextValue, nextCursor].
export function textInsertAt(value: string, cursor: number, input: string): [string, number] {
  return [value.slice(0, cursor) + input + value.slice(cursor), cursor + input.length]
}

// Backspace at cursor: delete char before cursor; returns [nextValue, nextCursor].
export function textDelAt(value: string, cursor: number): [string, number] {
  if (cursor === 0) return [value, 0]
  return [value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1]
}

// Forward delete: delete char after cursor; returns [nextValue, nextCursor].
export function textDelForward(value: string, cursor: number): [string, number] {
  if (cursor >= value.length) return [value, cursor]
  return [value.slice(0, cursor) + value.slice(cursor + 1), cursor]
}

// Terminal delete compatibility: if the key lands at end-of-line, treat it like
// backspace so terminals that report the main Delete key as `key.delete` still
// erase predictably. Otherwise keep forward-delete semantics.
export function textDelKey(value: string, cursor: number): [string, number] {
  if (cursor >= value.length) return textDelAt(value, cursor)
  return textDelForward(value, cursor)
}

// Ctrl+W: delete word backward from cursor; returns [nextValue, nextCursor].
export function textDelWord(value: string, cursor: number): [string, number] {
  if (cursor === 0) return [value, 0]
  let i = cursor
  // skip trailing spaces
  while (i > 0 && value[i - 1] === " ") i--
  // skip to previous word boundary
  while (i > 0 && value[i - 1] !== " ") i--
  return [value.slice(0, i) + value.slice(cursor), i]
}

export function textKillLine(value: string, cursor: number): [string, string] {
  if (cursor >= value.length) return [value, ""]
  const nl = value.indexOf("\n", cursor)
  const end = nl === -1 ? value.length : nl
  if (cursor === end) return [value.slice(0, cursor) + value.slice(cursor + 1), "\n"]
  return [value.slice(0, cursor) + value.slice(end), value.slice(cursor, end)]
}

// M6 multi-line pure helpers — exported for tests.

// Total line count (minimum 1).
export function lineCount(value: string): number {
  return value.split("\n").length
}

// 0-indexed line the cursor is on.
export function cursorLineIdx(value: string, cursor: number): number {
  return value.slice(0, cursor).split("\n").length - 1
}

// Move cursor up one line (same column, clamped to line length). Returns new cursor position.
export function cursorLineUp(value: string, cursor: number): number {
  const prefix = value.slice(0, cursor)
  const chunks = prefix.split("\n")
  if (chunks.length === 1) return cursor // already on first line
  const col = chunks[chunks.length - 1]!.length
  const prev = chunks[chunks.length - 2]!
  const prevStart = prefix.length - col - 1 - prev.length
  return prevStart + Math.min(col, prev.length)
}

// Move cursor down one line (same column, clamped to line length). Returns new cursor position.
export function cursorLineDown(value: string, cursor: number): number {
  const prefix = value.slice(0, cursor)
  const col = prefix.split("\n").at(-1)!.length
  const suffix = value.slice(cursor)
  const nl = suffix.indexOf("\n")
  if (nl === -1) return cursor // already on last line
  const nextStart = cursor + nl + 1
  const nextLine = value.slice(nextStart).split("\n")[0]!
  return nextStart + Math.min(col, nextLine.length)
}

/**
 * Cursor-aware text-editing state for the Composer.
 * Owns value + cursor + all primitive mutations.
 * Mention, slash, stash, history, and submit logic stay in Composer.
 *
 * setValue always moves cursor to end of the new value (covers history nav,
 * selectMention, composerAppend, and handleSlashSelect).
 */
export function useTextInput(initial = "") {
  const [state, setState] = useState({ value: initial, cursor: initial.length })
  const ring = useRef<string[]>([])
  const idx = useRef(0)
  const span = useRef<{ start: number; end: number } | null>(null)
  const op = useRef<"kill-head" | "kill-tail" | "yank" | null>(null)
  const buf = useUndoBuffer(state.value, state.cursor)

  const stop = () => {
    idx.current = 0
    span.current = null
    op.current = null
  }

  const kill = (text: string, side: "head" | "tail") => {
    if (!text) return
    const kind = side === "head" ? "kill-head" : "kill-tail"
    if (op.current === kind && ring.current.length > 0) {
      ring.current[ring.current.length - 1] =
        side === "head" ? text + ring.current[ring.current.length - 1]! : ring.current[ring.current.length - 1]! + text
    } else {
      ring.current = [...ring.current, text].slice(-20)
    }
    idx.current = 0
    span.current = null
    op.current = kind
  }

  const setValue = (next: string | ((prev: string) => string)) => (
    stop(),
    setState((s) => {
      const v = typeof next === "function" ? next(s.value) : next
      return { value: v, cursor: v.length }
    })
  )

  const insert = (input: string) => (
    stop(),
    setState((s) => {
      const [v, c] = textInsertAt(s.value, s.cursor, input)
      return { value: v, cursor: c }
    })
  )

  const del = () => (
    stop(),
    setState((s) => {
      const [v, c] = textDelAt(s.value, s.cursor)
      return { value: v, cursor: c }
    })
  )

  const deleteForward = () => (
    stop(),
    setState((s) => {
      const [v, c] = textDelForward(s.value, s.cursor)
      return { value: v, cursor: c }
    })
  )

  const deleteKey = () => (
    stop(),
    setState((s) => {
      const [v, c] = textDelKey(s.value, s.cursor)
      return { value: v, cursor: c }
    })
  )

  const deleteWord = () =>
    setState((s) => {
      const [v, c] = textDelWord(s.value, s.cursor)
      kill(s.value.slice(c, s.cursor), "head")
      return { value: v, cursor: c }
    })

  const killLine = () =>
    setState((s) => {
      const [v, text] = textKillLine(s.value, s.cursor)
      kill(text, "tail")
      return { value: v, cursor: s.cursor }
    })

  const yank = () => {
    idx.current = 0
    const text = ring.current[ring.current.length - 1 - idx.current] ?? ""
    if (!text) return false
    setState((s) => {
      const start = s.cursor
      const [v, c] = textInsertAt(s.value, start, text)
      span.current = { start, end: c }
      op.current = "yank"
      return { value: v, cursor: c }
    })
    return true
  }

  const yankPop = () => {
    if (op.current !== "yank" || !span.current || ring.current.length === 0) return false
    idx.current = (idx.current + 1) % ring.current.length
    const mark = span.current
    const text = ring.current[ring.current.length - 1 - idx.current] ?? ""
    setState((s) => {
      const v = s.value.slice(0, mark.start) + text + s.value.slice(mark.end)
      const end = mark.start + text.length
      span.current = { start: mark.start, end }
      op.current = "yank"
      return { value: v, cursor: end }
    })
    return true
  }

  const moveLeft = () => (stop(), setState((s) => ({ ...s, cursor: Math.max(0, s.cursor - 1) })))

  const moveRight = () => (stop(), setState((s) => ({ ...s, cursor: Math.min(s.value.length, s.cursor + 1) })))

  const home = () => (stop(), setState((s) => ({ ...s, cursor: 0 })))

  const end = () => (stop(), setState((s) => ({ ...s, cursor: s.value.length })))

  const clear = () => (stop(), setState({ value: "", cursor: 0 }))

  const undo = () => {
    const snap = buf.undo()
    if (!snap) return false
    stop()
    setState({ value: snap.text, cursor: snap.cursor })
    return true
  }

  // Insert a newline at the cursor (Alt+Enter).
  const newline = () => (
    stop(),
    setState((s) => {
      const [v, c] = textInsertAt(s.value, s.cursor, "\n")
      return { value: v, cursor: c }
    })
  )

  // Move cursor up one logical line (multi-line navigation).
  const lineUp = () => (stop(), setState((s) => ({ ...s, cursor: cursorLineUp(s.value, s.cursor) })))

  // Move cursor down one logical line (multi-line navigation).
  const lineDown = () => (stop(), setState((s) => ({ ...s, cursor: cursorLineDown(s.value, s.cursor) })))

  return {
    value: state.value,
    cursor: state.cursor,
    setValue,
    insert,
    del,
    deleteForward,
    deleteKey,
    deleteWord,
    moveLeft,
    moveRight,
    home,
    end,
    clear,
    undo,
    newline,
    lineUp,
    lineDown,
    killLine,
    yank,
    yankPop,
  }
}
