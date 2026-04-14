import { useState } from "react"

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

  const setValue = (next: string | ((prev: string) => string)) =>
    setState((s) => {
      const v = typeof next === "function" ? next(s.value) : next
      return { value: v, cursor: v.length }
    })

  const insert = (input: string) =>
    setState((s) => {
      const [v, c] = textInsertAt(s.value, s.cursor, input)
      return { value: v, cursor: c }
    })

  const del = () =>
    setState((s) => {
      const [v, c] = textDelAt(s.value, s.cursor)
      return { value: v, cursor: c }
    })

  const deleteForward = () =>
    setState((s) => {
      const [v, c] = textDelForward(s.value, s.cursor)
      return { value: v, cursor: c }
    })

  const deleteWord = () =>
    setState((s) => {
      const [v, c] = textDelWord(s.value, s.cursor)
      return { value: v, cursor: c }
    })

  const moveLeft = () => setState((s) => ({ ...s, cursor: Math.max(0, s.cursor - 1) }))

  const moveRight = () => setState((s) => ({ ...s, cursor: Math.min(s.value.length, s.cursor + 1) }))

  const home = () => setState((s) => ({ ...s, cursor: 0 }))

  const end = () => setState((s) => ({ ...s, cursor: s.value.length }))

  const clear = () => setState({ value: "", cursor: 0 })

  return {
    value: state.value,
    cursor: state.cursor,
    setValue,
    insert,
    del,
    deleteForward,
    deleteWord,
    moveLeft,
    moveRight,
    home,
    end,
    clear,
  }
}
